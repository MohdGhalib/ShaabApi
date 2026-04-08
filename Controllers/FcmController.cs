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
        List<FcmTokenRecord> list;

        if (row == null)
        {
            list = [];
            _db.Storage.Add(new StorageEntry
            {
                StoreKey   = "Shaab_FCM_Tokens",
                StoreValue = "[]"
            });
        }
        else
        {
            try { list = JsonSerializer.Deserialize<List<FcmTokenRecord>>(row.StoreValue ?? "[]") ?? []; }
            catch { list = []; }
        }

        // تحديث أو إضافة
        var existing = list.FindIndex(t => t.EmpId == empId);
        var record   = new FcmTokenRecord(empId, role, body.FcmToken);
        if (existing >= 0) list[existing] = record;
        else               list.Add(record);

        var json = JsonSerializer.Serialize(list);
        if (row != null) { row.StoreValue = json; row.UpdatedAt = DateTime.UtcNow; }
        else { var added = await _db.Storage.FindAsync("Shaab_FCM_Tokens"); if (added != null) added.StoreValue = json; }

        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}

public record FcmRegisterRequest(string? EmpId, string? Role, string FcmToken);
