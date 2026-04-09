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
            var empRow    = await _db.Storage.FindAsync("Shaab_Employees_DB");
            var empJson   = empRow?.StoreValue;
            var oldSnap   = oldValue;
            var newSnap   = body.Value!;
            _ = Task.Run(() => _DetectAndNotify(allTokens, empJson, oldSnap, newSnap));
        }

        await _db.SaveChangesAsync();

        // إرسال حدث SSE لجميع المتصلين (fire-and-forget)
        _ = SseController.Broadcast("reload", "1");

        return Ok(new { ok = true });
    }

    // آمن للاستدعاء من Task.Run — لا يستخدم DbContext
    private static async Task _DetectAndNotify(
        List<FcmTokenRecord> allTokens,
        string? empJson,
        string? oldValue,
        string newValue)
    {
        try
        {
            var (newMItems, newCIds, newI, approvedM, deliveredM, newAuditC) = DbHelper.CountNew(oldValue, newValue);
            var newC = newCIds.Count;
            Console.WriteLine($"[FCM] Detect → newM={newMItems.Count} newC={newC} newI={newI} approved={approvedM.Count} delivered={deliveredM.Count} newAudit={newAuditC} | tokens={allTokens.Count}");

            // ── منتسية جديدة → كول سنتر + موظفو الفرع ──
            if (newMItems.Count > 0)
            {
                // إشعار كول سنتر
                await FcmService.SendToRolesStatic(allTokens,
                    ["cc_manager", "cc_employee"],
                    "📋 منتسية جديدة",
                    newMItems.Count == 1 ? "تم إرسال منتسية جديدة" : $"تم إرسال {newMItems.Count} منتسيات جديدة",
                    data: new Dictionary<string, string> { ["montasiaId"] = newMItems.First().Id.ToString(), ["type"] = "new" });

                // إشعار موظفي وأبناء الفرع (تأكيد الاستلام)
                foreach (var grp in newMItems.GroupBy(x => x.Branch).Where(g => !string.IsNullOrEmpty(g.Key)))
                {
                    var tokens = DbHelper.GetBranchTokens(allTokens, empJson, grp.Key);
                    if (tokens.Count > 0)
                        await FcmService.SendToTokensStatic(tokens,
                            "✅ تم إرسال المنتسية",
                            grp.Count() == 1 ? "تم إرسال المنتسية للنظام بنجاح" : $"تم إرسال {grp.Count()} منتسيات للنظام",
                            data: new Dictionary<string, string> { ["montasiaId"] = grp.First().Id.ToString(), ["type"] = "new" });
                }
            }

            // ── تمت الموافقة (قيد الانتظار) → موظفو الفرع + مدير الفرع ──
            if (approvedM.Count > 0)
            {
                foreach (var grp in approvedM.GroupBy(x => x.Branch).Where(g => !string.IsNullOrEmpty(g.Key)))
                {
                    var tokens = DbHelper.GetBranchTokens(allTokens, empJson, grp.Key);
                    if (tokens.Count > 0)
                        await FcmService.SendToTokensStatic(tokens,
                            "✅ تمت الموافقة على المنتسية",
                            grp.Count() == 1 ? "تمت الموافقة على المنتسية وهي جاهزة للتسليم" : $"تمت الموافقة على {grp.Count()} منتسيات",
                            data: new Dictionary<string, string> { ["montasiaId"] = grp.First().Id.ToString(), ["type"] = "approval" });
                }
            }

            // ── تم التسليم → كول سنتر + موظفو الفرع + مدير الفرع ──
            if (deliveredM.Count > 0)
            {
                var count   = deliveredM.Count;
                var firstId = deliveredM.First().Id.ToString();

                // إشعار كول سنتر
                await FcmService.SendToRolesStatic(allTokens,
                    ["cc_manager", "cc_employee"],
                    "📦 تم تسليم منتسية",
                    count == 1 ? "تم تسليم المنتسية" : $"تم تسليم {count} منتسيات",
                    data: new Dictionary<string, string> { ["montasiaId"] = firstId, ["type"] = "delivered" });

                // إشعار موظفي الفرع ومدير الفرع (بدون مدير المنطقة)
                foreach (var grp in deliveredM.GroupBy(x => x.Branch).Where(g => !string.IsNullOrEmpty(g.Key)))
                {
                    var tokens = DbHelper.GetBranchTokens(allTokens, empJson, grp.Key);
                    if (tokens.Count > 0)
                        await FcmService.SendToTokensStatic(tokens,
                            "📦 تم تسليم المنتسية",
                            grp.Count() == 1 ? "تم تسليم المنتسية بنجاح" : $"تم تسليم {grp.Count()} منتسيات",
                            data: new Dictionary<string, string> { ["montasiaId"] = grp.First().Id.ToString(), ["type"] = "delivered" });
                }
            }

            // ── شكوى جديدة → كول سنتر + السيطرة + مديرو الفروع والمناطق ──
            if (newC > 0)
                await FcmService.SendToRolesStatic(allTokens,
                    ["cc_manager", "control_employee", "branch_manager", "area_manager"],
                    "🚨 شكوى جديدة",
                    newC == 1 ? "تم إضافة شكوى جديدة" : $"تم إضافة {newC} شكاوي جديدة",
                    data: new Dictionary<string, string> { ["complaintId"] = newCIds.First().ToString(), ["type"] = "complaint" });

            // ── رد جديد من السيطرة على شكوى → كول سنتر + ميديا ──
            if (newAuditC > 0)
                await FcmService.SendToRolesStatic(allTokens,
                    ["cc_manager", "cc_employee", "media"],
                    "✅ تم الرد على شكوى",
                    newAuditC == 1 ? "أضاف قسم السيطرة رداً على شكوى" : $"أضاف قسم السيطرة رداً على {newAuditC} شكاوي",
                    data: new Dictionary<string, string> { ["type"] = "complaint_audit" });

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
    public record MontasiaEvent(long Id, string EmpId, string Branch);

    private record MontasiaInfo(string Status, string EmpId, string Branch);

    private static Dictionary<long, MontasiaInfo> _GetMontasiatMap(JsonElement root)
    {
        var map = new Dictionary<long, MontasiaInfo>();
        if (!root.TryGetProperty("montasiat", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return map;
        foreach (var el in arr.EnumerateArray())
        {
            if (!el.TryGetProperty("id", out var idEl) || !idEl.TryGetInt64(out var id)) continue;
            var status = el.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
            var empId  = el.TryGetProperty("empId",  out var ei) ? ei.GetString() ?? "" : "";
            var branch = el.TryGetProperty("branch", out var br) ? br.GetString() ?? "" : "";
            map[id] = new MontasiaInfo(status, empId, branch);
        }
        return map;
    }

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

    // يعيد مجموعة IDs الشكاوى التي لها رد audit
    private static HashSet<long> _GetAuditedComplaintIds(JsonElement root)
    {
        var set = new HashSet<long>();
        if (!root.TryGetProperty("complaints", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return set;
        foreach (var el in arr.EnumerateArray())
            if (el.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var id))
            {
                var audit = el.TryGetProperty("audit", out var a) ? a.GetString() ?? "" : "";
                if (!string.IsNullOrEmpty(audit)) set.Add(id);
            }
        return set;
    }

    private static readonly HashSet<string> _DeliveredStatuses =
        ["تم التسليم", "تم الاستلام", "مكتمل", "تم"];

    public static (
        List<MontasiaEvent> newMItems,
        List<long> newCIds, int newI,
        List<MontasiaEvent> approvedM,
        List<MontasiaEvent> deliveredM,
        int newAuditC
    ) CountNew(string? oldJson, string newJson)
    {
        Dictionary<long, MontasiaInfo> oldM = [];
        Dictionary<long, string> oldC = [], oldI = [];

        if (!string.IsNullOrEmpty(oldJson))
        {
            try
            {
                var o = JsonDocument.Parse(oldJson).RootElement;
                oldM = _GetMontasiatMap(o);
                oldC = _GetIdStatus(o, "complaints");
                oldI = _GetIdStatus(o, "inquiries");
            }
            catch { }
        }
        HashSet<long> oldAudited = [];
        if (!string.IsNullOrEmpty(oldJson))
        {
            try { oldAudited = _GetAuditedComplaintIds(JsonDocument.Parse(oldJson).RootElement); } catch { }
        }

        try
        {
            var n       = JsonDocument.Parse(newJson).RootElement;
            var newMMap = _GetMontasiatMap(n);
            var newCMap = _GetIdStatus(n, "complaints");
            var newIMap = _GetIdStatus(n, "inquiries");
            var newAudited = _GetAuditedComplaintIds(n);

            // منتسيات جديدة
            var newMItems = newMMap
                .Where(kv => !oldM.ContainsKey(kv.Key))
                .Select(kv => new MontasiaEvent(kv.Key, kv.Value.EmpId, kv.Value.Branch))
                .ToList();

            var newCIds = newCMap.Keys.Except(oldC.Keys).ToList();
            var ni = newIMap.Keys.Except(oldI.Keys).Count();

            // شكاوى حصلت على رد جديد من السيطرة
            var newAuditC = newAudited.Except(oldAudited).Count();

            // منتسيات تمت الموافقة عليها: قيد الاستلام → قيد الانتظار
            var approvedM = newMMap
                .Where(kv => kv.Value.Status == "قيد الانتظار" &&
                             oldM.TryGetValue(kv.Key, out var old) &&
                             old.Status == "قيد الاستلام")
                .Select(kv => new MontasiaEvent(kv.Key, kv.Value.EmpId, kv.Value.Branch))
                .ToList();

            // منتسيات تغيّرت حالتها إلى "تم التسليم"
            var deliveredM = newMMap
                .Where(kv =>
                    _DeliveredStatuses.Any(s => kv.Value.Status.Contains(s)) &&
                    oldM.TryGetValue(kv.Key, out var old) &&
                    !_DeliveredStatuses.Any(s => old.Status.Contains(s)))
                .Select(kv => new MontasiaEvent(kv.Key, kv.Value.EmpId, kv.Value.Branch))
                .ToList();

            return (newMItems, newCIds, ni, approvedM, deliveredM, newAuditC);
        }
        catch { return ([], new List<long>(), 0, [], [], 0); }
    }

    // ── إيجاد tokens موظفي الفرع ومدير الفرع فقط (بدون مدير المنطقة) ──────
    public static List<string> GetBranchTokens(
        List<FcmTokenRecord> allTokens,
        string? empJson,
        string branch)
    {
        if (string.IsNullOrEmpty(empJson) || string.IsNullOrEmpty(branch)) return [];

        var branchEmpIds = new HashSet<string>();
        try
        {
            var arr = JsonDocument.Parse(empJson).RootElement;
            if (arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var emp in arr.EnumerateArray())
                {
                    var empId = emp.TryGetProperty("empId", out var ei) ? ei.GetString() ?? "" : "";
                    if (string.IsNullOrEmpty(empId)) continue;

                    bool found = false;

                    // assignedBranches (قائمة)
                    if (emp.TryGetProperty("assignedBranches", out var bs) && bs.ValueKind == JsonValueKind.Array)
                        foreach (var b in bs.EnumerateArray())
                            if (b.TryGetProperty("branch", out var bn) && bn.GetString() == branch)
                            { found = true; break; }

                    // assignedBranch (مفرد)
                    if (!found
                        && emp.TryGetProperty("assignedBranch", out var single)
                        && single.ValueKind == JsonValueKind.Object
                        && single.TryGetProperty("branch", out var sbn)
                        && sbn.GetString() == branch)
                        found = true;

                    if (found) branchEmpIds.Add(empId);
                }
            }
        }
        catch { }

        Console.WriteLine($"[FCM] Branch '{branch}' → empIds: [{string.Join(",", branchEmpIds)}]");

        // فلترة: موظف الفرع أو مدير الفرع فقط — بدون مدير المنطقة
        return allTokens
            .Where(t => branchEmpIds.Contains(t.EmpId)
                        && (t.Role == "branch_employee" || t.Role == "branch_manager"))
            .Select(t => t.FcmToken)
            .Distinct()
            .ToList();
    }
}
