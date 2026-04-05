using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using ShaabApi.Data;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ShaabApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext  _db;
    private readonly IConfiguration _config;

    // Rate limiting: ip → (failCount, lockUntil)
    private static readonly ConcurrentDictionary<string, RateEntry> _rates       = new();
    private static readonly ConcurrentDictionary<string, RateEntry> _changeRates = new();

    private const int PbkdfIterations = 100_000;

    public AuthController(AppDbContext db, IConfiguration config)
    {
        _db     = db;
        _config = config;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest body)
    {
        var ip   = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var pass = body.Password ?? "";

        // ── فحص حد المحاولات ──
        if (_rates.TryGetValue(ip, out var entry) && DateTime.UtcNow < entry.LockUntil)
        {
            var secs = (int)(entry.LockUntil - DateTime.UtcNow).TotalSeconds + 1;
            return StatusCode(429, new { error = $"محاولات كثيرة — انتظر {secs} ثانية" });
        }

        // ── التحقق من كلمة المرور ──
        var passHash  = Sha256(pass);
        var adminHash = _config["AdminPasswordHash"] ?? "";

        string? name = null, title = null, empId = null, role = null;
        bool isAdmin = false;

        if (passHash == adminHash)
        {
            name = "المدير"; title = "مدير النظام";
            empId = "admin"; role = "admin"; isAdmin = true;
        }
        else
        {
            var row = await _db.Storage.FindAsync("Shaab_Employees_DB");
            if (row != null)
            {
                var emps = JsonSerializer.Deserialize<List<EmpRecord>>(row.StoreValue) ?? [];
                var cand = emps.FirstOrDefault(e => e.EmpId == pass);
                if (cand != null && !string.IsNullOrEmpty(cand.PasswordHash))
                {
                    var salt = cand.Salt ?? "";
                    if (VerifyPassword(pass, salt, cand.PasswordHash))
                    {
                        name    = cand.Name;
                        title   = cand.Title;
                        empId   = cand.EmpId;
                        isAdmin = false;
                        role    = TitleToRole(cand.Title);

                        // ترقية تلقائية: SHA-256 → PBKDF2
                        if (!cand.PasswordHash.StartsWith("pbkdf2:"))
                        {
                            if (string.IsNullOrEmpty(cand.Salt)) cand.Salt = GenerateSalt();
                            cand.PasswordHash = HashPbkdf2(pass, cand.Salt);
                            row.StoreValue    = JsonSerializer.Serialize(emps);
                            row.UpdatedAt     = DateTime.UtcNow;
                            await _db.SaveChangesAsync();
                        }
                    }
                }
            }
        }

        if (name == null)
        {
            _rates.AddOrUpdate(ip,
                _ => new RateEntry(1, DateTime.MinValue),
                (_, old) =>
                {
                    var c = old.Count + 1;
                    return c >= 5
                        ? new RateEntry(0, DateTime.UtcNow.AddSeconds(60))
                        : new RateEntry(c, DateTime.MinValue);
                });
            return Unauthorized(new { error = "بيانات الدخول غير صحيحة" });
        }

        _rates.TryRemove(ip, out _);

        // تنظيف الإدخالات المنتهية دورياً
        foreach (var key in _rates.Keys)
            if (_rates.TryGetValue(key, out var e) && e.Count == 0 && DateTime.UtcNow >= e.LockUntil)
                _rates.TryRemove(key, out _);

        var token = GenerateToken(name, title!, empId!, role!, isAdmin);
        return Ok(new { token, name, title, empId, role, isAdmin });
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public IActionResult Me()
    {
        return Ok(new {
            name    = User.FindFirst("name")?.Value,
            title   = User.FindFirst("title")?.Value,
            empId   = User.FindFirst("empId")?.Value,
            role    = User.FindFirst("role")?.Value,
            isAdmin = User.FindFirst("isAdmin")?.Value == "true"
        });
    }

    // POST /api/auth/admin-reset-password  — للمدير فقط
    [HttpPost("admin-reset-password")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> AdminResetPassword([FromBody] AdminResetRequest body)
    {
        if (User.FindFirst("isAdmin")?.Value != "true")
            return Forbid();

        if (string.IsNullOrEmpty(body.EmpId) || string.IsNullOrEmpty(body.NewPassword))
            return BadRequest(new { error = "يرجى تعبئة جميع الحقول" });

        var row = await _db.Storage.FindAsync("Shaab_Employees_DB");
        if (row == null) return BadRequest(new { error = "لم يُعثر على قاعدة بيانات الموظفين" });

        var emps = JsonSerializer.Deserialize<List<EmpRecord>>(row.StoreValue) ?? [];
        var emp  = emps.FirstOrDefault(e => e.EmpId == body.EmpId);
        if (emp == null) return NotFound(new { error = "لم يُعثر على الموظف" });

        emp.Salt         = GenerateSalt();
        emp.PasswordHash = HashPbkdf2(body.NewPassword, emp.Salt);
        row.StoreValue   = JsonSerializer.Serialize(emps);
        row.UpdatedAt    = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    [HttpPost("change-password")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest body)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (_changeRates.TryGetValue(ip, out var cr) && DateTime.UtcNow < cr.LockUntil)
        {
            var secs = (int)(cr.LockUntil - DateTime.UtcNow).TotalSeconds + 1;
            return StatusCode(429, new { error = $"محاولات كثيرة — انتظر {secs} ثانية" });
        }

        var empId = User.FindFirst("empId")?.Value ?? "";
        if (string.IsNullOrEmpty(empId) || empId == "admin")
            return BadRequest(new { error = "غير مسموح" });

        if (string.IsNullOrEmpty(body.OldPassword) || string.IsNullOrEmpty(body.NewPassword))
            return BadRequest(new { error = "يرجى تعبئة جميع الحقول" });

        if (body.NewPassword.Length < 4)
            return BadRequest(new { error = "كلمة المرور يجب أن تكون 4 أحرف على الأقل" });

        var row = await _db.Storage.FindAsync("Shaab_Employees_DB");
        if (row == null) return BadRequest(new { error = "لم يُعثر على قاعدة بيانات الموظفين" });

        var emps = JsonSerializer.Deserialize<List<EmpRecord>>(row.StoreValue) ?? [];
        var emp  = emps.FirstOrDefault(e => e.EmpId == empId);
        if (emp == null) return NotFound(new { error = "لم يُعثر على الموظف" });

        if (!VerifyPassword(body.OldPassword, emp.Salt ?? "", emp.PasswordHash ?? ""))
        {
            _changeRates.AddOrUpdate(ip,
                _ => new RateEntry(1, DateTime.MinValue),
                (_, old) => old.Count + 1 >= 5
                    ? new RateEntry(0, DateTime.UtcNow.AddSeconds(60))
                    : new RateEntry(old.Count + 1, DateTime.MinValue));
            return BadRequest(new { error = "كلمة المرور الحالية غير صحيحة" });
        }

        _changeRates.TryRemove(ip, out _);

        // تحديث بـ PBKDF2
        emp.Salt         = GenerateSalt();
        emp.PasswordHash = HashPbkdf2(body.NewPassword, emp.Salt);
        row.StoreValue   = JsonSerializer.Serialize(emps);
        row.UpdatedAt    = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    // ── مساعدات ──

    private string GenerateToken(string name, string title, string empId, string role, bool isAdmin)
    {
        var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds  = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddHours(double.Parse(_config["Jwt:ExpiryHours"] ?? "12"));

        var claims = new[]
        {
            new Claim("name",    name),
            new Claim("title",   title),
            new Claim("empId",   empId),
            new Claim("role",    role),
            new Claim("isAdmin", isAdmin ? "true" : "false"),
        };

        var token = new JwtSecurityToken(
            issuer:            _config["Jwt:Issuer"],
            audience:          _config["Jwt:Issuer"],
            claims:            claims,
            expires:           expiry,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string Sha256(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLower();
    }

    // PBKDF2 — تشفير أقوى لكلمات المرور
    private static string HashPbkdf2(string password, string salt)
    {
        using var kdf = new Rfc2898DeriveBytes(
            Encoding.UTF8.GetBytes(password),
            Encoding.UTF8.GetBytes(salt),
            PbkdfIterations,
            HashAlgorithmName.SHA256);
        return "pbkdf2:" + Convert.ToHexString(kdf.GetBytes(32)).ToLower();
    }

    private static bool VerifyPassword(string password, string salt, string storedHash)
    {
        if (storedHash.StartsWith("pbkdf2:"))
            return HashPbkdf2(password, salt) == storedHash;
        return Sha256(salt + password) == storedHash; // SHA-256 القديم
    }

    private static string GenerateSalt()
    {
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower();
    }

    private static string TitleToRole(string title) => title switch
    {
        "مدير الكول سنتر"   => "cc_manager",
        "موظف كول سنتر"     => "cc_employee",
        "قسم السيطرة"       => "control",
        "موظف ميديا"        => "media",
        "مدير قسم السيطرة"  => "control_employee",
        "موظف سيطرة"        => "control_sub",
        _                   => "cc_employee"
    };
}

public record LoginRequest(string? Password);
public record ChangePasswordRequest(string? OldPassword, string? NewPassword);
public record AdminResetRequest(string? EmpId, string? NewPassword);
public record RateEntry(int Count, DateTime LockUntil);

public class EmpRecord
{
    [JsonPropertyName("empId")]    public string  EmpId        { get; set; } = "";
    [JsonPropertyName("name")]     public string  Name         { get; set; } = "";
    [JsonPropertyName("title")]    public string  Title        { get; set; } = "";
    [JsonPropertyName("salt")]     public string? Salt         { get; set; }
    [JsonPropertyName("passwordHash")] public string? PasswordHash { get; set; }
}
