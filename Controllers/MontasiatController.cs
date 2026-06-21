using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;
using ShaabApi.Services;

namespace ShaabApi.Controllers;

/// <summary>
/// Phase 4a + Phase 5a of migration #11 — read + per-record write endpoints
/// for montasiat. Frontend reads via GET (Phase 4b); Phase 5b will switch
/// writes to POST/PUT/DELETE so we stop shipping 6 MB Master_DB blobs.
/// </summary>
[ApiController]
[Route("api/montasiat")]
[Authorize]
public class MontasiatController : ControllerBase
{
    private readonly AppDbContext _db;
    public MontasiatController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rows = await _db.Montasiat
            .OrderByDescending(m => m.Id)
            .ToListAsync();

        var result = rows.Select(ToDto).ToList();
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "body must be a JSON object" });
        if (!RecordMapper.TryGetLongId(body, out var id) || id <= 0)
            return BadRequest(new { error = "id required" });

        var existing = await _db.Montasiat.FindAsync(id);
        if (existing != null)
            return Conflict(new { error = "id already exists", id });

        var entity = new Montasia { Id = id, Version = 1, CreatedAt = DateTime.UtcNow };
        _ApplyFields(entity, body);

        /* 🔒 (Serial fix, 2026-06-10) توليد الرقم المرجعي على الخادم.
           السبب: العميل يولّد الـ serial من عدّاد مخزَّن في الـ blob المشترك ويُزامَن
           لاحقاً، فجهازان يحملان نفس العدّاد المتقادم كانا يولّدان نفس الرقم (مثل 261963)
           دون أن يرفض شيء التصادم. الآن الخادم هو المرجع: نحترم سيريال العميل لو كان
           سليماً وغير مستخدَم، وإلا نُولّد التالي الحر للسنة. الفهرس الفريد
           ux_montasiat_serial هو خط الدفاع الأخير ضد سباق إنشاءين متزامنين. */
        entity.Serial = await _EnsureSerialAsync(entity.Serial, entity.Iso);

        _db.Montasiat.Add(entity);
        for (var attempt = 0; ; attempt++)
        {
            try { await _db.SaveChangesAsync(); break; }
            catch (DbUpdateException ex) when (attempt < 6 && _IsDuplicateSerialViolation(ex))
            {
                // سباق إنشاء متزامن خطف رقمنا — هات التالي وأعد المحاولة (الكيان ما زال Added).
                entity.Serial = await _NextSerialAsync(entity.Iso);
            }
        }

        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, record = ToDto(entity) });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "body must be a JSON object" });

        var entity = await _db.Montasiat.FindAsync(id);
        if (entity == null) return NotFound(new { error = "not found", id });

        // 🔒 (IDOR guard) الحذف الناعم عبر PUT حصري لمدير الكول سنتر/الأدمن (يطابق deleteM + purge)
        if (RecordMapper.BodySetsDeleted(body))
        {
            var _isAdm = User.FindFirst("isAdmin")?.Value == "true";
            var _rl    = User.FindFirst("role")?.Value ?? "";
            if (!_isAdm && _rl != "cc_manager")
            {
                Console.WriteLine($"[montasiat] id={id} soft-delete via PUT blocked (role='{_rl}')");
                return Ok(new { ok = true, record = ToDto(entity), deleteBlocked = true });
            }
        }

        /* 🛡️ (Delivery-revert guard on PUT, 2026-06-09) بعد هجرة per-record صار PUT
           هو مسار كل تعديل، فأي عميل يحمل نسخة قديمة (تطبيق الموبايل / دمج التعارض في
           الويب) قد يدهس منتسية "تم التسليم" بحالة أقدم. الحارس الموجود في
           PerRecordSyncService يحمي مسار الـ blob فقط — هنا نحميه على الـ PUT أيضاً.
           الإلغاء المشروع للتسليم (saveMontasiaStatus) حصري لمدير الكول سنتر/الأدمن،
           لذا نسمح به لهما فقط ونمنع الارتداد لبقية الأدوار. نُعيد النسخة المُسلَّمة
           الحالية حتى يتصالح العميل القديم ويتوقّف عن إعادة المحاولة. */
        var incomingStatus = RecordMapper.GetStringOrNull(body, "status", 50);
        if (entity.Status == "تم التسليم" && incomingStatus != "تم التسليم")
        {
            var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
            var role    = User.FindFirst("role")?.Value ?? "";
            if (!isAdmin && role != "cc_manager")
            {
                Console.WriteLine($"[montasiat] id={id} delivery-revert blocked on PUT (role='{role}', incoming='{incomingStatus}') — kept 'تم التسليم'");
                return Ok(new { ok = true, record = ToDto(entity), revertBlocked = true });
            }
        }

        var prevSerial = entity.Serial;
        _ApplyFields(entity, body);
        entity.Version++;

        /* 🔒 (Serial fix, 2026-06-10) لا تدع PUT يغيّر الرقم المرجعي إلى رقم يملكه
           سجل آخر. بعد إصلاح التكرار + التوليد على الخادم صارت الأرقام فريدة وثابتة،
           فأي عميل قديم يرسل سيريالاً متصادماً = نُبقي رقم السجل القديم بدل رفض الحفظ. */
        if (entity.Serial != prevSerial && !string.IsNullOrEmpty(entity.Serial))
        {
            var serial = entity.Serial;
            var clash = await _db.Montasiat.AnyAsync(m => m.Id != id && m.Serial == serial);
            if (clash)
            {
                Console.WriteLine($"[montasiat] id={id} serial collision on PUT ('{prevSerial}'→'{entity.Serial}') — kept '{prevSerial}'");
                entity.Serial = prevSerial;
            }
        }

        await _db.SaveChangesAsync();
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, record = ToDto(entity) });
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        // 🔒 (IDOR guard) الحذف حصري لمدير الكول سنتر/الأدمن (يطابق صلاحية deleteM)
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        var role    = User.FindFirst("role")?.Value ?? "";
        if (!isAdmin && role != "cc_manager") return Forbid();

        var entity = await _db.Montasiat.FindAsync(id);
        if (entity == null) return NotFound(new { error = "not found", id });

        // Soft delete: merge { deleted: true } into the data JSON column
        entity.Data = RecordMapper.MergeDeletedFlag(entity.Data);
        entity.Version++;

        await _db.SaveChangesAsync();
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, id });
    }

    // Hard delete (permanent purge) — used by trash bin only.
    // Restricted to admin / cc_manager.
    [HttpDelete("{id:long}/purge")]
    public async Task<IActionResult> Purge(long id)
    {
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        var role    = User.FindFirst("role")?.Value ?? "";
        if (!isAdmin && role != "cc_manager") return Forbid();

        var entity = await _db.Montasiat.FindAsync(id);
        if (entity == null) return NotFound(new { error = "not found", id });

        _db.Montasiat.Remove(entity);
        await _db.SaveChangesAsync();
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, id, purged = true });
    }

    // ── server-authoritative serial helpers (2026-06-10) ─────────────────

    /// <summary>Honor a well-formed, unused client serial; otherwise mint the next free one.</summary>
    private async Task<string> _EnsureSerialAsync(string? clientSerial, string? iso)
    {
        var norm = MontasiatSerial.Normalize(clientSerial);
        if (MontasiatSerial.IsWellFormed(norm))
        {
            var taken = await _db.Montasiat.AnyAsync(m => m.Serial == norm);
            if (!taken) return norm;
        }
        return await _NextSerialAsync(iso);
    }

    private async Task<string> _NextSerialAsync(string? iso)
    {
        var yy = MontasiatSerial.YearPrefix(iso);
        var existing = await _db.Montasiat
            .Where(m => m.Serial != null && m.Serial.StartsWith(yy))
            .Select(m => m.Serial!)
            .ToListAsync();
        return MontasiatSerial.Next(existing, yy);
    }

    /// <summary>True when a save failed because the unique serial index rejected a duplicate.
    /// Matches MySQL (Pomelo/MySqlConnector) and SQLite (tests) error text.</summary>
    private static bool _IsDuplicateSerialViolation(DbUpdateException ex)
    {
        var msg = ex.GetBaseException().Message ?? "";
        return msg.Contains("ux_montasiat_serial")
            || (msg.Contains("Duplicate entry") && msg.Contains("serial"))
            || msg.Contains("UNIQUE constraint failed: montasiat.serial");
    }

    private static readonly HashSet<string> _typedFields = new(StringComparer.Ordinal)
    {
        "id", "serial", "branch", "type", "status", "time", "iso", "addedBy"
    };

    private static void _ApplyFields(Montasia e, JsonElement body)
    {
        e.Serial  = RecordMapper.GetStringOrNull(body, "serial",  30);
        e.Branch  = RecordMapper.GetStringOrNull(body, "branch",  100);
        e.Type    = RecordMapper.GetStringOrNull(body, "type",    50);
        e.Status  = RecordMapper.GetStringOrNull(body, "status",  50);
        e.Time    = RecordMapper.GetStringOrNull(body, "time",    50);
        e.Iso     = RecordMapper.GetStringOrNull(body, "iso",     50);
        e.AddedBy = RecordMapper.GetStringOrNull(body, "addedBy", 100);
        e.Data    = RecordMapper.ExtractExtraFields(body, _typedFields);
    }

    public static Dictionary<string, object?> ToDto(Montasia m)
    {
        var dict = new Dictionary<string, object?>
        {
            ["id"]      = m.Id,
            ["serial"]  = m.Serial,
            ["branch"]  = m.Branch,
            ["type"]    = m.Type,
            ["status"]  = m.Status,
            ["time"]    = m.Time,
            ["iso"]     = m.Iso,
            ["addedBy"] = m.AddedBy
        };
        DtoHelper.MergeDataExtras(m.Data, dict);
        return dict;
    }
}
