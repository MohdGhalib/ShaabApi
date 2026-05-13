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
        "Shaab_Firebase_Creds",
        "Shaab_AuditNotes_DB",
        "Shaab_Compensations_DB",
        "Shaab_AuditSettings_DB"
    ];

    // هذه المفاتيح لا يمكن تعديلها إلا من قِبل المدراء
    private static readonly HashSet<string> _adminOnlyKeys = ["Shaab_Employees_DB"];

    private readonly AppDbContext         _db;
    private readonly FcmService           _fcm;
    private readonly PerRecordSyncService _perRecordSync;

    public StorageController(AppDbContext db, FcmService fcm, PerRecordSyncService perRecordSync)
    {
        _perRecordSync = perRecordSync;
        _db = db;
        _fcm = fcm;
    }

    // GET /api/storage?keys=key1,key2,...
    // الاستجابة: { key1: value, key2: value, _versions: { key1: 5, key2: 12 } }
    // الكلاينتس القديمة تتجاهل _versions، الجديدة تستخدمها للحفاظ على التزامن.
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string keys)
    {
        var keyList = keys?
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList() ?? [];

        var result   = new Dictionary<string, object?>();
        var versions = new Dictionary<string, long>();

        foreach (var k in keyList) { result[k] = null; versions[k] = 0; }

        if (keyList.Count > 0)
        {
            var rows = await _db.Storage
                .Where(s => keyList.Contains(s.StoreKey))
                .ToListAsync();

            foreach (var row in rows)
            {
                result[row.StoreKey]   = row.StoreValue;
                versions[row.StoreKey] = row.Version;
            }
        }

        result["_versions"] = versions;
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
        var currentVersion = existing?.Version ?? 0;

        // ── 🔒 Optimistic Concurrency: فحص expectedVersion إن أرسلها الكلاينت ──
        // soft mode: لو ما أرسل version (كلاينت قديم)، نقبل لكن نحذّر في log
        // hard mode: لو أرسل version لا تطابق → 409 Conflict + الـ version الحالية
        if (body.ExpectedVersion.HasValue)
        {
            if (body.ExpectedVersion.Value != currentVersion)
            {
                var userEmpId = User.FindFirst("empId")?.Value ?? "?";
                Console.WriteLine($"[STORAGE] ⚡ VERSION CONFLICT key={body.Key} by={userEmpId} " +
                                  $"expected={body.ExpectedVersion.Value} current={currentVersion}");
                return Conflict(new
                {
                    error           = "version_conflict",
                    message         = "البيانات على السيرفر تغيّرت — حدّث وأعد المحاولة",
                    expectedVersion = body.ExpectedVersion.Value,
                    currentVersion  = currentVersion
                });
            }
        }
        else if (body.Key == "Shaab_Master_DB")
        {
            // كلاينت قديم لم يرسل version على Master_DB — تسجيل تحذير فقط (soft mode)
            var userEmpId = User.FindFirst("empId")?.Value ?? "?";
            Console.WriteLine($"[STORAGE] ⚠ LEGACY WRITE (no version) key=Master by={userEmpId}");
        }

        // ── 🛡️ حارس فقدان البيانات + Logging مفصّل لـ Shaab_Master_DB ──
        // يكشف كل عملية حفظ تُنقص الحجم بشكل مريب → يطبع تشخيص كامل ويرفض الكتابة الكارثية.
        // ملاحظة: الحارس يثق بالكلاينتس التي ترسل expectedVersion صحيح
        // (هؤلاء قد عاينوا البيانات الحالية، فالـ shrink منهم متعمَّد كـ auto-purge)
        bool clientHasValidVersion = body.ExpectedVersion.HasValue && body.ExpectedVersion.Value == currentVersion;
        if (body.Key == "Shaab_Master_DB" && !string.IsNullOrEmpty(oldValue) && !string.IsNullOrEmpty(body.Value))
        {
            var oldSize = oldValue.Length;
            var newSize = body.Value!.Length;
            var sizeDelta = newSize - oldSize;
            var pctChange = oldSize > 0 ? ((double)sizeDelta / oldSize) * 100 : 0;

            var oldCounts = DbHelper.CountItems(oldValue);
            var newCounts = DbHelper.CountItems(body.Value!);
            var mDelta = newCounts.Montasiat  - oldCounts.Montasiat;
            var iDelta = newCounts.Inquiries  - oldCounts.Inquiries;
            var cDelta = newCounts.Complaints - oldCounts.Complaints;

            // هوية المستخدم من JWT
            var userEmpId = User.FindFirst("empId")?.Value
                          ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                          ?? "?";
            var userRole  = User.FindFirst("role")?.Value ?? "?";
            var userName  = User.FindFirst("name")?.Value ?? "?";
            var ip        = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "?";
            var ts        = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            // كل حفظ يُسجَّل بالتفاصيل
            Console.WriteLine($"[STORAGE] {ts} key=Master by={userEmpId}({userName}) role={userRole} ip={ip} " +
                              $"size: {oldSize}→{newSize} ({sizeDelta:+#;-#;0}B, {pctChange:+0.0;-0.0;0}%) " +
                              $"counts: M{oldCounts.Montasiat}→{newCounts.Montasiat}({mDelta:+#;-#;0}) " +
                              $"I{oldCounts.Inquiries}→{newCounts.Inquiries}({iDelta:+#;-#;0}) " +
                              $"C{oldCounts.Complaints}→{newCounts.Complaints}({cDelta:+#;-#;0})");

            // 🚨 الحالة الكارثية: انكماش حاد + سجلات اختفت
            // (الحذف الناعم لا يُنقص العدد — السجل يبقى مع deleted=true. اختفاء فعلي = طمس)
            bool isCatastrophic = (mDelta < -5 || iDelta < -5 || cDelta < -5)
                                  && pctChange < -10;

            if (isCatastrophic && !clientHasValidVersion)
            {
                // فقط نرفض لو الكلاينت لم يرسل version صحيحة (دليل أنه قد لا يكون رأى البيانات الحديثة)
                Console.WriteLine($"[STORAGE] 🚨🚨🚨 BLOCKED CATASTROPHIC WRITE — STALE OVERWRITE DETECTED 🚨🚨🚨");
                Console.WriteLine($"[STORAGE]   from={userEmpId}({userName}) role={userRole} ip={ip}");
                Console.WriteLine($"[STORAGE]   would lose: M={Math.Abs(mDelta)} I={Math.Abs(iDelta)} C={Math.Abs(cDelta)}");
                Console.WriteLine($"[STORAGE]   size shrink: {pctChange:0.0}%");
                return Conflict(new {
                    error = "Stale overwrite blocked",
                    detail = "هذا الحفظ يُنقص البيانات بشكل مريب — مرفوض لحماية النظام. حدّث الصفحة وأعد المحاولة.",
                    serverItems = new { newCounts.Montasiat, newCounts.Inquiries, newCounts.Complaints },
                    yourItems   = new { oldCounts.Montasiat, oldCounts.Inquiries, oldCounts.Complaints }
                });
            }
            if (isCatastrophic && clientHasValidVersion)
            {
                // عميل بـ version صحيحة لكن shrink كبير — على الأرجح auto-purge شرعي. نسجّله ولا نرفض.
                Console.WriteLine($"[STORAGE] ℹ Catastrophic shrink ALLOWED (valid version) by={userEmpId} — likely auto-purge");
            }

            // ⚠️ تحذير ناعم: انكماش بسيط لكن مريب
            if (mDelta < 0 || iDelta < 0 || cDelta < 0)
            {
                Console.WriteLine($"[STORAGE] ⚠️ SHRINK WARN by={userEmpId}({userName}) — items decreased");
            }
        }

        long newVersion;
        if (existing is null)
        {
            newVersion = 1;
            _db.Storage.Add(new StorageEntry
            {
                StoreKey   = body.Key,
                StoreValue = body.Value,
                UpdatedAt  = DateTime.UtcNow,
                Version    = newVersion
            });
        }
        else
        {
            newVersion = currentVersion + 1;
            existing.StoreValue = body.Value;
            existing.UpdatedAt  = DateTime.UtcNow;
            existing.Version    = newVersion;
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

        // 🔄 Phase 2 (Migration #11): Dual-write per-record tables for Master_DB
        // Source of truth is still the JSON blob; this builds shadow tables for Phase 4 cutover.
        // Best-effort — exceptions are caught inside the service and never bubble up.
        if (body.Key == "Shaab_Master_DB" && !string.IsNullOrEmpty(body.Value))
        {
            try
            {
                // Phase 5d: skip dual-write for lite blobs (Phase 5b clients dispatch
                // per-record directly via /api/{type}). Only legacy full blobs (with
                // record arrays embedded) still need the mirror.
                if (_BlobHasRecordArrays(body.Value!))
                {
                    var (inq, mnt, cmp) = await _perRecordSync.SyncMasterDbAsync(body.Value!, oldValue);
                    Console.WriteLine($"[DUAL-WRITE] legacy full-blob mirrored: I={inq} M={mnt} C={cmp}");
                }
                else
                {
                    Console.WriteLine("[DUAL-WRITE] skipped — lite blob (Phase 5b client)");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DUAL-WRITE] outer guard caught: {ex.Message}");
            }
        }

        // إرسال حدث SSE لجميع المتصلين (fire-and-forget)
        _ = SseController.Broadcast("reload", "1");

        return Ok(new { ok = true, version = newVersion });
    }

    // آمن للاستدعاء من Task.Run — لا يستخدم DbContext
    // Phase 5d: detect whether a Master_DB payload still ships the heavy record arrays.
    // Lite blobs (post-Phase 5b) omit them since records flow through /api/{type} endpoints.
    private static bool _BlobHasRecordArrays(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return false;
            return (root.TryGetProperty("inquiries",  out var i) && i.ValueKind == JsonValueKind.Array)
                || (root.TryGetProperty("montasiat",  out var m) && m.ValueKind == JsonValueKind.Array)
                || (root.TryGetProperty("complaints", out var c) && c.ValueKind == JsonValueKind.Array);
        }
        catch { return false; }
    }

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

                // SSE: إشعار فوري لمستخدمي الويب (يُشغَّل الصوت من SSE handler مباشرة)
                var first   = newMItems.First();
                var truncNotes = (first.Notes ?? "").Length > 120 ? first.Notes.Substring(0, 120) : (first.Notes ?? "");
                var ssePayload = System.Text.Json.JsonSerializer.Serialize(new {
                    branch  = first.Branch,
                    city    = first.City,
                    type    = first.Type,
                    notes   = truncNotes,
                    addedBy = first.AddedBy,
                    count   = newMItems.Count
                });
                _ = SseController.Broadcast("new-montasia", ssePayload);
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

public record StorageRequest(string Key, string? Value, long? ExpectedVersion = null);

// ── مساعدة: كشف العناصر الجديدة وإرسال إشعار FCM ──────────────────────────
file static class DbHelper
{
    public record MontasiaEvent(long Id, string EmpId, string Branch, string City = "", string Type = "", string Notes = "", string AddedBy = "");
    public record ItemCounts(int Montasiat, int Inquiries, int Complaints);

    private record MontasiaInfo(string Status, string EmpId, string Branch, string City, string Type, string Notes, string AddedBy);

    // عدّ السجلات في كل مجموعة (للكشف عن طمس البيانات)
    public static ItemCounts CountItems(string? json)
    {
        if (string.IsNullOrEmpty(json)) return new ItemCounts(0, 0, 0);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            int CountArr(string key) =>
                root.TryGetProperty(key, out var arr) && arr.ValueKind == JsonValueKind.Array
                    ? arr.GetArrayLength() : 0;
            return new ItemCounts(CountArr("montasiat"), CountArr("inquiries"), CountArr("complaints"));
        }
        catch { return new ItemCounts(0, 0, 0); }
    }

    private static Dictionary<long, MontasiaInfo> _GetMontasiatMap(JsonElement root)
    {
        var map = new Dictionary<long, MontasiaInfo>();
        if (!root.TryGetProperty("montasiat", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return map;
        foreach (var el in arr.EnumerateArray())
        {
            if (!el.TryGetProperty("id", out var idEl) || !idEl.TryGetInt64(out var id)) continue;
            var status  = el.TryGetProperty("status",  out var st) ? st.GetString() ?? "" : "";
            var empId   = el.TryGetProperty("empId",   out var ei) ? ei.GetString() ?? "" : "";
            var branch  = el.TryGetProperty("branch",  out var br) ? br.GetString() ?? "" : "";
            var city    = el.TryGetProperty("city",    out var ci) ? ci.GetString() ?? "" : "";
            var type    = el.TryGetProperty("type",    out var ty) ? ty.GetString() ?? "" : "";
            var notes   = el.TryGetProperty("notes",   out var no) ? no.GetString() ?? "" : "";
            var addedBy = el.TryGetProperty("addedBy", out var ab) ? ab.GetString() ?? "" : "";
            map[id] = new MontasiaInfo(status, empId, branch, city, type, notes, addedBy);
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
                .Select(kv => new MontasiaEvent(kv.Key, kv.Value.EmpId, kv.Value.Branch, kv.Value.City, kv.Value.Type, kv.Value.Notes, kv.Value.AddedBy))
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
