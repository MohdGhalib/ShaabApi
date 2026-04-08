using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;
using ShaabApi.Services;
using System.Text.Json;

namespace ShaabApi.Controllers;

[ApiController]
[Route("api/storage")]
[Authorize]
public class StorageController : ControllerBase
{
    private const int MaxPayloadBytes = 10 * 1024 * 1024; // 10 MB

    // المفاتيح المسموح بها فقط
    private static readonly HashSet<string> _allowedKeys =
    [
        "Shaab_Master_DB",
        "Shaab_Employees_DB",
        "Shaab_Breaks_DB",
        "Shaab_Sessions_DB",
        "Shaab_PriceList_DB",
        "Shaab_FCM_Tokens"
    ];

    // هذه المفاتيح لا يمكن تعديلها إلا من قِبل المدراء
    private static readonly HashSet<string> _adminOnlyKeys = ["Shaab_Employees_DB"];

    private readonly AppDbContext _db;
    private readonly FcmService   _fcm;

    public StorageController(AppDbContext db, FcmService fcm)
    {
        _db = db;
        _fcm = fcm;
    }

    // GET /api/storage?keys=key1,key2,...
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string keys)
    {
        var keyList = keys?
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList() ?? [];

        var result = keyList.ToDictionary(k => k, _ => (string?)null);

        if (keyList.Count > 0)
        {
            var rows = await _db.Storage
                .Where(s => keyList.Contains(s.StoreKey))
                .ToListAsync();

            foreach (var row in rows)
                result[row.StoreKey] = row.StoreValue;
        }

        return Ok(result);
    }

    // POST /api/storage  body: { "key": "...", "value": "..." }
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] StorageRequest body)
    {
        if (string.IsNullOrEmpty(body.Key))
            return BadRequest(new { error = "Invalid input" });

        // التحقق من أن المفتاح مسموح به
        if (!_allowedKeys.Contains(body.Key))
            return BadRequest(new { error = "Key not allowed" });

        // فحص حجم الحمولة
        var valueLength = System.Text.Encoding.UTF8.GetByteCount(body.Value ?? "");
        if (valueLength > MaxPayloadBytes)
            return BadRequest(new { error = "Payload too large" });

        // التحقق من أن القيمة JSON صحيح
        if (!string.IsNullOrEmpty(body.Value))
        {
            try { JsonDocument.Parse(body.Value); }
            catch (JsonException)
            {
                return BadRequest(new { error = "Value is not valid JSON" });
            }
        }

        // حماية مفاتيح المدراء — يمنع الكتابة من غير المخوّلين
        if (_adminOnlyKeys.Contains(body.Key))
        {
            var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
            var role    = User.FindFirst("role")?.Value ?? "";
            if (!isAdmin && role != "cc_manager" && role != "control_employee")
                return Forbid();
        }

        var existing = await _db.Storage.FindAsync(body.Key);
        var oldValue = existing?.StoreValue; // للمقارنة لاحقاً
        if (existing is null)
        {
            _db.Storage.Add(new StorageEntry { StoreKey = body.Key, StoreValue = body.Value });
        }
        else
        {
            existing.StoreValue = body.Value;
            existing.UpdatedAt  = DateTime.UtcNow;
        }

        // كشف العناصر الجديدة في Shaab_Master_DB → إرسال FCM
        if (body.Key == "Shaab_Master_DB" && !string.IsNullOrEmpty(body.Value))
        {
            _ = Task.Run(() => _DetectAndNotify(oldValue, body.Value!));
        }

        await _db.SaveChangesAsync();

        // إرسال حدث SSE لجميع المتصلين (fire-and-forget)
        _ = SseController.Broadcast("reload", "1");

        return Ok(new { ok = true });
    }

    private async Task _DetectAndNotify(string? oldValue, string newValue)
    {
        try
        {
            var (newM, newC, newI) = DbHelper.CountNew(oldValue, newValue);

            if (newM > 0)
                await _fcm.SendToRoles(["cc_manager", "cc_employee"],
                    "📋 منتسية جديدة",
                    newM == 1 ? "تم إضافة منتسية جديدة" : $"تم إضافة {newM} منتسيات جديدة");

            if (newC > 0)
                await _fcm.SendToRoles(["cc_manager", "control_employee"],
                    "🚨 شكوى جديدة",
                    newC == 1 ? "تم إضافة شكوى جديدة" : $"تم إضافة {newC} شكاوي جديدة");

            if (newI > 0)
                await _fcm.SendToRoles(["cc_manager", "cc_employee"],
                    "💬 استفسار جديد",
                    newI == 1 ? "تم إضافة استفسار جديد" : $"تم إضافة {newI} استفسارات جديدة");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FCM] DetectAndNotify error: {ex.Message}");
        }
    }
}

public record StorageRequest(string Key, string? Value);

// ── مساعدة: كشف العناصر الجديدة وإرسال إشعار FCM ──────────────────────────
file static class DbHelper
{
    private static HashSet<long> _GetIds(JsonElement root, string key)
    {
        var ids = new HashSet<long>();
        if (root.TryGetProperty(key, out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var el in arr.EnumerateArray())
                if (el.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var id))
                    ids.Add(id);
        return ids;
    }

    public static (int newM, int newC, int newI) CountNew(string? oldJson, string newJson)
    {
        HashSet<long> oldM = [], oldC = [], oldI = [];
        if (!string.IsNullOrEmpty(oldJson))
        {
            try
            {
                var o = JsonDocument.Parse(oldJson).RootElement;
                oldM = _GetIds(o, "montasiat");
                oldC = _GetIds(o, "complaints");
                oldI = _GetIds(o, "inquiries");
            }
            catch { }
        }
        try
        {
            var n = JsonDocument.Parse(newJson).RootElement;
            var nm = _GetIds(n, "montasiat").Except(oldM).Count();
            var nc = _GetIds(n, "complaints").Except(oldC).Count();
            var ni = _GetIds(n, "inquiries").Except(oldI).Count();
            return (nm, nc, ni);
        }
        catch { return (0, 0, 0); }
    }
}
