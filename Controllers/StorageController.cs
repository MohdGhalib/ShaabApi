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
        "Shaab_FCM_Tokens",
        "Shaab_Firebase_Creds"
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
            await _fcm.EnsureInitializedAsync();
            var allTokens = await _fcm.GetAllTokens();
            var oldSnap   = oldValue;
            var newSnap   = body.Value!;
            _ = Task.Run(() => _DetectAndNotify(allTokens, oldSnap, newSnap));
        }

        await _db.SaveChangesAsync();

        // إرسال حدث SSE لجميع المتصلين (fire-and-forget)
        _ = SseController.Broadcast("reload", "1");

        return Ok(new { ok = true });
    }

    // آمن للاستدعاء من Task.Run — لا يستخدم DbContext
    private static async Task _DetectAndNotify(List<FcmTokenRecord> allTokens, string? oldValue, string newValue)
    {
        try
        {
            var (newM, newC, newI, deliveredM) = DbHelper.CountNew(oldValue, newValue);

            // ── منتسية جديدة → كول سنتر ──
            if (newM > 0)
                await FcmService.SendToRolesStatic(allTokens,
                    ["cc_manager", "cc_employee"],
                    "📋 منتسية جديدة",
                    newM == 1 ? "تم إرسال منتسية جديدة" : $"تم إرسال {newM} منتسيات جديدة");

            // ── منتسية تم تسليمها → مدير الفرع / مدير المنطقة / موظف الفرع ──
            if (deliveredM > 0)
                await FcmService.SendToRolesStatic(allTokens,
                    ["branch_manager", "area_manager", "branch_employee"],
                    "✅ تم تسليم منتسية",
                    deliveredM == 1 ? "تمت الموافقة على منتسيتك وتسليمها" : $"تمت الموافقة على {deliveredM} منتسيات وتسليمها");

            // ── شكوى جديدة → كول سنتر + السيطرة + مديرو الفروع والمناطق ──
            if (newC > 0)
                await FcmService.SendToRolesStatic(allTokens,
                    ["cc_manager", "control_employee", "branch_manager", "area_manager"],
                    "🚨 شكوى جديدة",
                    newC == 1 ? "تم إضافة شكوى جديدة" : $"تم إضافة {newC} شكاوي جديدة");

            // ── استفسار جديد → كول سنتر ──
            if (newI > 0)
                await FcmService.SendToRolesStatic(allTokens,
                    ["cc_manager", "cc_employee"],
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
    private static Dictionary<long, string> _GetIdStatus(JsonElement root, string key)
    {
        var map = new Dictionary<long, string>();
        if (root.TryGetProperty(key, out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var el in arr.EnumerateArray())
                if (el.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var id))
                {
                    var status = el.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
                    map[id] = status;
                }
        return map;
    }

    private static readonly HashSet<string> _DeliveredStatuses =
        ["تم التسليم", "تم الاستلام", "مكتمل", "تم"];

    public static (int newM, int newC, int newI, int deliveredM) CountNew(string? oldJson, string newJson)
    {
        Dictionary<long, string> oldM = [], oldC = [], oldI = [];
        if (!string.IsNullOrEmpty(oldJson))
        {
            try
            {
                var o = JsonDocument.Parse(oldJson).RootElement;
                oldM = _GetIdStatus(o, "montasiat");
                oldC = _GetIdStatus(o, "complaints");
                oldI = _GetIdStatus(o, "inquiries");
            }
            catch { }
        }
        try
        {
            var n = JsonDocument.Parse(newJson).RootElement;
            var newMMap = _GetIdStatus(n, "montasiat");
            var newCMap = _GetIdStatus(n, "complaints");
            var newIMap = _GetIdStatus(n, "inquiries");

            var nm = newMMap.Keys.Except(oldM.Keys).Count();
            var nc = newCMap.Keys.Except(oldC.Keys).Count();
            var ni = newIMap.Keys.Except(oldI.Keys).Count();

            // منتسيات تغيّرت حالتها إلى "تم التسليم"
            var dm = newMMap.Count(kv =>
                _DeliveredStatuses.Any(s => kv.Value.Contains(s)) &&
                oldM.TryGetValue(kv.Key, out var oldStatus) &&
                !_DeliveredStatuses.Any(s => oldStatus.Contains(s)));

            return (nm, nc, ni, dm);
        }
        catch { return (0, 0, 0, 0); }
    }
}
