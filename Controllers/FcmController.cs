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

        // تهيئة Firebase عند التسجيل إن لم تتم بعد
        var fcm = HttpContext.RequestServices.GetRequiredService<FcmService>();
        await fcm.EnsureInitializedAsync();

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

    // POST /api/fcm/unregister — يحذف FCM token للموظف عند تسجيل الخروج
    [HttpPost("unregister")]
    public async Task<IActionResult> Unregister()
    {
        var empId = User.FindFirst("empId")?.Value ?? "";
        if (string.IsNullOrEmpty(empId)) return BadRequest();

        var row = await _db.Storage.FindAsync("Shaab_FCM_Tokens");
        if (row == null || string.IsNullOrEmpty(row.StoreValue))
            return Ok(new { ok = true });

        List<FcmTokenRecord> list;
        try { list = JsonSerializer.Deserialize<List<FcmTokenRecord>>(row.StoreValue) ?? []; }
        catch { return Ok(new { ok = true }); }

        var before = list.Count;
        list.RemoveAll(t => t.EmpId == empId);

        if (list.Count != before)
        {
            row.StoreValue = JsonSerializer.Serialize(list);
            row.UpdatedAt  = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Console.WriteLine($"[FCM] Unregistered token for empId={empId}");
        }

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
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        var role    = User.FindFirst("role")?.Value ?? "";
        if (!isAdmin && role != "cc_manager") return Forbid();
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
