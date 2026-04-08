using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShaabApi.Data;
using ShaabApi.Models;
using ShaabApi.Services;
using System.Text.Json;

namespace ShaabApi.Controllers;

[ApiController]
[Route("api/fcm")]
[Authorize]
public class FcmController : ControllerBase
{
    private readonly AppDbContext _db;

    public FcmController(AppDbContext db)
    {
        _db = db;
    }

    // POST /api/fcm/register  — يحفظ FCM token للموظف الحالي
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] FcmRegisterRequest body)
    {
        if (string.IsNullOrEmpty(body.FcmToken)) return BadRequest();

        var empId = body.EmpId ?? User.FindFirst("empId")?.Value ?? "";
        var role  = body.Role  ?? User.FindFirst("role")?.Value  ?? "";

        var row = await _db.Storage.FindAsync("Shaab_FCM_Tokens");

        List<FcmTokenRecord> list = [];
        if (row != null && !string.IsNullOrEmpty(row.StoreValue))
        {
            try { list = JsonSerializer.Deserialize<List<FcmTokenRecord>>(row.StoreValue) ?? []; }
            catch { list = []; }
        }

        // تحديث أو إضافة
        var idx = list.FindIndex(t => t.EmpId == empId);
        var record = new FcmTokenRecord(empId, role, body.FcmToken);
        if (idx >= 0) list[idx] = record;
        else          list.Add(record);

        var json = JsonSerializer.Serialize(list);

        if (row == null)
        {
            _db.Storage.Add(new StorageEntry
            {
                StoreKey   = "Shaab_FCM_Tokens",
                StoreValue = json,
                UpdatedAt  = DateTime.UtcNow,
            });
        }
        else
        {
            row.StoreValue = json;
            row.UpdatedAt  = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        Console.WriteLine($"[FCM] Registered token for empId={empId} role={role}");
        return Ok(new { ok = true });
    }

    // GET /api/fcm/tokens — للمدير فقط (تشخيص)
    [HttpGet("tokens")]
    public async Task<IActionResult> GetTokens()
    {
        if (User.FindFirst("isAdmin")?.Value != "true") return Forbid();
        var row = await _db.Storage.FindAsync("Shaab_FCM_Tokens");
        return Ok(new { raw = row?.StoreValue ?? "[]" });
    }

    // POST /api/fcm/set-credentials — يحفظ Firebase service account JSON في DB
    [HttpPost("set-credentials")]
    public async Task<IActionResult> SetCredentials([FromBody] FcmCredsRequest body)
    {
        if (User.FindFirst("isAdmin")?.Value != "true") return Forbid();
        if (string.IsNullOrWhiteSpace(body.Json)) return BadRequest(new { error = "json is required" });

        // تحقق أن الـ JSON صالح
        try { System.Text.Json.JsonDocument.Parse(body.Json); }
        catch { return BadRequest(new { error = "invalid JSON" }); }

        var row = await _db.Storage.FindAsync(FcmService.CredsKey);
        if (row == null)
            _db.Storage.Add(new ShaabApi.Models.StorageEntry { StoreKey = FcmService.CredsKey, StoreValue = body.Json, UpdatedAt = DateTime.UtcNow });
        else
        { row.StoreValue = body.Json; row.UpdatedAt = DateTime.UtcNow; }

        await _db.SaveChangesAsync();
        Console.WriteLine("[FCM] Credentials saved to database");
        return Ok(new { ok = true, message = "Credentials saved. Firebase will initialize on next request." });
    }
}

public record FcmCredsRequest(string Json);

public record FcmRegisterRequest(string? EmpId, string? Role, string FcmToken);
