using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using ShaabApi.Data;
using ShaabApi.Models;
using ShaabApi.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace ShaabApi.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext    _db;
    private readonly IConfiguration  _config;
    private readonly FcmService      _fcm;

    private static readonly object _rateLock = new();
    private static readonly Dictionary<string, (int Count, DateTime LockUntil)> _rates = new();

    public AdminController(AppDbContext db, IConfiguration config, FcmService fcm)
    {
        _db     = db;
        _config = config;
        _fcm    = fcm;
    }

    // ── POST /api/admin/unlock ──────────────────────────────────────────
    [HttpPost("unlock")]
    public IActionResult Unlock([FromBody] AdminUnlockRequest body)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        lock (_rateLock)
        {
            if (_rates.TryGetValue(ip, out var e) && DateTime.UtcNow < e.LockUntil)
                return StatusCode(429, new { error = "محاولات كثيرة — انتظر قليلاً" });
        }

        var expected = _config["AdminPanelPassword"] ?? "0785110515";
        if ((body.Password ?? "") != expected)
        {
            lock (_rateLock)
            {
                _rates.TryGetValue(ip, out var old);
                var c = old.Count + 1;
                _rates[ip] = c >= 5
                    ? (0, DateTime.UtcNow.AddSeconds(120))
                    : (c, DateTime.MinValue);
            }
            return Unauthorized(new { error = "كلمة المرور غير صحيحة" });
        }

        lock (_rateLock) { _rates.Remove(ip); }

        var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds  = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddHours(24);
        var claims = new[]
        {
            new Claim("name",    "لوحة التحكم"),
            new Claim("title",   "مدير التطبيق"),
            new Claim("empId",   "admin_panel"),
            new Claim("role",    "admin"),
            new Claim("isAdmin", "true"),
        };
        var jwt = new JwtSecurityToken(
            _config["Jwt:Issuer"], _config["Jwt:Issuer"],
            claims, expires: expiry, signingCredentials: creds);
        return Ok(new { token = new JwtSecurityTokenHandler().WriteToken(jwt) });
    }

    // ── GET /api/admin/control ─────────────────────────────────────────
    [HttpGet("control")]
    [Authorize]
    public async Task<IActionResult> GetControl()
    {
        var row = await _db.Storage.FindAsync("Shaab_App_Control");
        if (row == null || string.IsNullOrEmpty(row.StoreValue))
            return Ok(new AppControlData());
        try
        {
            return Ok(JsonSerializer.Deserialize<AppControlData>(row.StoreValue) ?? new AppControlData());
        }
        catch { return Ok(new AppControlData()); }
    }

    // ── POST /api/admin/control ─────────────────────────────────────────
    [HttpPost("control")]
    [Authorize]
    public async Task<IActionResult> SetControl([FromBody] AppControlData body)
    {
        if (User.FindFirst("isAdmin")?.Value != "true") return Forbid();

        if (body.Stopped && string.IsNullOrEmpty(body.StoppedAt))
            body.StoppedAt = DateTime.UtcNow.ToString("o");

        if (!body.Stopped)
        {
            body.Reason    = "";
            body.StopUntil = null;
            body.StoppedAt = null;
        }

        var json = JsonSerializer.Serialize(body);
        var row  = await _db.Storage.FindAsync("Shaab_App_Control");
        if (row == null)
            _db.Storage.Add(new StorageEntry { StoreKey = "Shaab_App_Control", StoreValue = json });
        else { row.StoreValue = json; row.UpdatedAt = DateTime.UtcNow; }

        await _db.SaveChangesAsync();
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true });
    }

    // ── POST /api/admin/transfer ────────────────────────────────────────
    [HttpPost("transfer")]
    [Authorize]
    public async Task<IActionResult> Transfer([FromBody] TransferRequest body)
    {
        if (User.FindFirst("isAdmin")?.Value != "true") return Forbid();
        if (string.IsNullOrEmpty(body.EmpId) || string.IsNullOrEmpty(body.NewBranch))
            return BadRequest(new { error = "بيانات ناقصة" });

        var row = await _db.Storage.FindAsync("Shaab_Employees_DB");
        if (row == null) return NotFound(new { error = "لم يُعثر على بيانات الموظفين" });

        try
        {
            var arr = JsonNode.Parse(row.StoreValue ?? "[]") as JsonArray ?? new JsonArray();
            string? empName = null;
            bool found = false;

            foreach (var node in arr)
            {
                if (node?["empId"]?.GetValue<string>() == body.EmpId)
                {
                    empName = node["name"]?.GetValue<string>();
                    node["assignedBranch"] = new JsonObject
                    {
                        ["branch"] = body.NewBranch,
                        ["city"]   = body.NewCity ?? ""
                    };
                    found = true;
                    break;
                }
            }

            if (!found) return NotFound(new { error = "لم يُعثر على الموظف" });

            row.StoreValue = arr.ToJsonString();
            row.UpdatedAt  = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            _ = SseController.Broadcast("reload", "1");

            // إشعار FCM للموظف المنقول
            await _fcm.EnsureInitializedAsync();
            if (_fcm.IsReady)
            {
                var allTokens = await _fcm.GetAllTokens();
                await FcmService.SendToEmpIdsStatic(
                    allTokens,
                    [body.EmpId],
                    "🔄 تم تغيير فرعك",
                    $"تم نقلك إلى فرع {body.NewBranch} — {body.NewCity}");
            }

            return Ok(new { ok = true, empName });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── POST /api/admin/broadcast ───────────────────────────────────────
    [HttpPost("broadcast")]
    [Authorize]
    public async Task<IActionResult> Broadcast([FromBody] BroadcastRequest body)
    {
        if (User.FindFirst("isAdmin")?.Value != "true") return Forbid();
        if (string.IsNullOrWhiteSpace(body.Title) || string.IsNullOrWhiteSpace(body.Body))
            return BadRequest(new { error = "العنوان والنص مطلوبان" });
        if (body.Roles == null || body.Roles.Count == 0)
            return BadRequest(new { error = "حدد المستلمين" });

        await _fcm.EnsureInitializedAsync();
        if (!_fcm.IsReady)
            return StatusCode(503, new { error = "خدمة الإشعارات غير متاحة" });

        var allTokens = await _fcm.GetAllTokens();
        Console.WriteLine($"[Admin] Broadcast → roles={string.Join(",", body.Roles)} totalTokens={allTokens.Count}");

        List<string> tokens;
        if (body.Roles.Contains("all"))
        {
            tokens = allTokens.Select(t => t.FcmToken).Distinct().ToList();
        }
        else
        {
            tokens = allTokens
                .Where(t => body.Roles.Contains(t.Role))
                .Select(t => t.FcmToken)
                .Distinct()
                .ToList();
        }

        if (tokens.Count == 0)
            return Ok(new { ok = true, sent = 0, message = "لا يوجد مستلمون" });

        await FcmService.SendToTokensStatic(tokens, body.Title.Trim(), body.Body.Trim());
        Console.WriteLine($"[Admin] Broadcast sent to {tokens.Count} devices");
        return Ok(new { ok = true, sent = tokens.Count });
    }
}

public class AppControlData
{
    [JsonPropertyName("stopped")]   public bool    Stopped   { get; set; } = false;
    [JsonPropertyName("reason")]    public string  Reason    { get; set; } = "";
    [JsonPropertyName("stopUntil")] public string? StopUntil { get; set; }
    [JsonPropertyName("stoppedAt")] public string? StoppedAt { get; set; }
}

public record AdminUnlockRequest(string? Password);
public record TransferRequest(string? EmpId, string? NewBranch, string? NewCity);

public class BroadcastRequest
{
    [JsonPropertyName("title")] public string  Title { get; set; } = "";
    [JsonPropertyName("body")]  public string  Body  { get; set; } = "";
    [JsonPropertyName("roles")] public List<string> Roles { get; set; } = [];
}
