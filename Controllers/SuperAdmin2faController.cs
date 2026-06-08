using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtpNet;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Controllers;

/// <summary>
/// TOTP (Google Authenticator) two-factor for the super-admin login.
/// The secret lives server-side in the storage table under a key that the public
/// GET /api/storage refuses to return. setup/disable are gated by the super-admin
/// password (config "SuperAdminPassword"); verify checks the rotating 6-digit code.
/// Anonymous by design — 2FA runs during the super-admin login (before any JWT).
/// </summary>
[ApiController]
[Route("api/sa2fa")]
[AllowAnonymous]
public class SuperAdmin2faController : ControllerBase
{
    private readonly AppDbContext   _db;
    private readonly IConfiguration _config;

    private const string SECRET_KEY = "Shaab_SA_TOTP_SECRET";

    // basic IP throttle for verify (TOTP brute-force protection)
    private static readonly Dictionary<string, (int count, DateTime windowEnd)> _attempts = new();
    private static readonly object _lock = new();

    public SuperAdmin2faController(AppDbContext db, IConfiguration config) { _db = db; _config = config; }

    public record SetupReq(string? Password, string? Code);
    public record VerifyReq(string? Code);
    public record DisableReq(string? Password, string? Code);

    private string _SaPwd() => _config["SuperAdminPassword"] ?? "090999797269";

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var row = await _db.Storage.FindAsync(SECRET_KEY);
        return Ok(new { enabled = row != null && !string.IsNullOrEmpty(row.StoreValue) });
    }

    /// <summary>Enable/reset 2FA. First time: super-admin password only. Reset: password + current code.</summary>
    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] SetupReq req)
    {
        if (string.IsNullOrEmpty(req?.Password) || req.Password != _SaPwd())
            return Unauthorized(new { error = "كلمة مرور السوبر أدمن غير صحيحة" });

        var existing = await _db.Storage.FindAsync(SECRET_KEY);
        if (existing != null && !string.IsNullOrEmpty(existing.StoreValue))
        {
            // already enabled → require a valid current code to reset (so a leaked password alone can't reset it)
            var t = new Totp(Base32Encoding.ToBytes(existing.StoreValue));
            if (string.IsNullOrWhiteSpace(req.Code) ||
                !t.VerifyTotp(req.Code.Trim(), out _, new VerificationWindow(previous: 1, future: 1)))
                return Unauthorized(new { error = "أدخل رمز التحقق الحالي لإعادة التعيين" });
        }

        var secretBytes = KeyGeneration.GenerateRandomKey(20); // 160-bit
        var base32 = Base32Encoding.ToString(secretBytes);

        if (existing == null)
        {
            _db.Storage.Add(new StorageEntry { StoreKey = SECRET_KEY, StoreValue = base32, Version = 1, UpdatedAt = DateTime.UtcNow });
        }
        else
        {
            existing.StoreValue = base32; existing.Version++; existing.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();

        const string issuer = "محامص الشعب";
        const string account = "Super Admin";
        var otpauth = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(account)}"
                    + $"?secret={base32}&issuer={Uri.EscapeDataString(issuer)}&digits=6&period=30";
        return Ok(new { ok = true, secret = base32, otpauth });
    }

    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] VerifyReq req)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "?";
        lock (_lock)
        {
            if (_attempts.TryGetValue(ip, out var a) && a.windowEnd > DateTime.UtcNow && a.count >= 5)
                return StatusCode(429, new { error = "محاولات كثيرة — انتظر دقيقة" });
        }

        var row = await _db.Storage.FindAsync(SECRET_KEY);
        if (row == null || string.IsNullOrEmpty(row.StoreValue))
            return Ok(new { ok = false, notEnabled = true });
        if (string.IsNullOrWhiteSpace(req?.Code))
            return BadRequest(new { error = "code required" });

        var totp = new Totp(Base32Encoding.ToBytes(row.StoreValue));
        bool valid = totp.VerifyTotp(req.Code.Trim(), out _, new VerificationWindow(previous: 1, future: 1));

        lock (_lock)
        {
            if (!valid)
            {
                var cur = (_attempts.TryGetValue(ip, out var x) && x.windowEnd > DateTime.UtcNow) ? x.count : 0;
                _attempts[ip] = (cur + 1, DateTime.UtcNow.AddMinutes(1));
            }
            else _attempts.Remove(ip);
        }
        return Ok(new { ok = valid });
    }

    /// <summary>Disable 2FA — requires both the super-admin password AND a valid current code.</summary>
    [HttpPost("disable")]
    public async Task<IActionResult> Disable([FromBody] DisableReq req)
    {
        if (string.IsNullOrEmpty(req?.Password) || req.Password != _SaPwd())
            return Unauthorized(new { error = "كلمة مرور غير صحيحة" });

        var row = await _db.Storage.FindAsync(SECRET_KEY);
        if (row != null && !string.IsNullOrEmpty(row.StoreValue))
        {
            var totp = new Totp(Base32Encoding.ToBytes(row.StoreValue));
            if (string.IsNullOrWhiteSpace(req.Code) ||
                !totp.VerifyTotp(req.Code.Trim(), out _, new VerificationWindow(previous: 1, future: 1)))
                return Unauthorized(new { error = "رمز التحقق غير صحيح" });
            _db.Storage.Remove(row);
            await _db.SaveChangesAsync();
        }
        return Ok(new { ok = true, disabled = true });
    }
}
