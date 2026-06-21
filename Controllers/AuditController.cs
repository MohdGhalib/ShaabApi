using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;
using ShaabApi.Services;

namespace ShaabApi.Controllers;

/// <summary>
/// Audit log stored in its own table (off the Master_DB blob) so retention can be
/// months without bloating saves. POST appends one entry; bulk for migration;
/// GET queries by date range.
/// </summary>
[ApiController]
[Route("api/audit")]
[Authorize]
public class AuditController : ControllerBase
{
    private readonly AppDbContext _db;
    public AuditController(AppDbContext db) { _db = db; }

    /// <summary>Append one audit entry. Idempotent on id (duplicates ignored).</summary>
    [HttpPost]
    public async Task<IActionResult> Add([FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "body must be a JSON object" });

        var e = _FromJson(body);
        if (e == null || string.IsNullOrEmpty(e.Id))
            return BadRequest(new { error = "id required" });

        // 🔒 الهوية تُختم من الـ JWT لا من جسم الطلب — يمنع تزوير منفّذ الإجراء في سجل التدقيق
        e.EmpId  = User?.FindFirst("empId")?.Value ?? e.EmpId;
        e.Role   = User?.FindFirst("role")?.Value  ?? e.Role;
        e.ByName = User?.FindFirst("name")?.Value  ?? e.ByName;

        var exists = await _db.AuditLog.AnyAsync(x => x.Id == e.Id);
        if (!exists)
        {
            _db.AuditLog.Add(e);
            // idempotent: لو سبق طلب متزامن بنفس الـ id فأدخله، نتجاهل تعارض المفتاح الأساسي
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { /* duplicate id inserted concurrently — treat as success */ }
        }
        return Ok(new { ok = true, id = e.Id });
    }

    /// <summary>Bulk insert (migration of existing in-blob entries). Skips existing ids.</summary>
    [HttpPost("bulk")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> AddBulk([FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Array)
            return BadRequest(new { error = "body must be a JSON array" });

        var incoming = new List<AuditEntry>();
        foreach (var el in body.EnumerateArray())
        {
            var e = _FromJson(el);
            if (e != null && !string.IsNullOrEmpty(e.Id)) incoming.Add(e);
        }
        if (incoming.Count == 0) return Ok(new { ok = true, added = 0 });

        var ids = incoming.Select(x => x.Id).ToList();
        var existing = (await _db.AuditLog.Where(x => ids.Contains(x.Id)).Select(x => x.Id).ToListAsync()).ToHashSet();

        int added = 0;
        foreach (var e in incoming)
        {
            if (existing.Contains(e.Id)) continue;
            existing.Add(e.Id);          // guard against duplicate ids within the same payload
            _db.AuditLog.Add(e);
            added++;
        }
        if (added > 0)
        {
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { /* overlapping ids across concurrent bulks — best-effort */ }
        }
        return Ok(new { ok = true, added });
    }

    /// <summary>Query entries by epoch-ms range (default: last 180 days), newest first.</summary>
    [HttpGet]
    public async Task<IActionResult> GetRange([FromQuery] long? fromTs, [FromQuery] long? toTs, [FromQuery] int? limit)
    {
        long from = fromTs ?? DateTimeOffset.UtcNow.AddDays(-180).ToUnixTimeMilliseconds();
        long to   = toTs   ?? DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeMilliseconds();
        int  cap  = (limit is int l && l > 0 && l <= 20000) ? l : 10000;

        var rows = await _db.AuditLog
            .Where(x => x.Ts >= from && x.Ts <= to)
            .OrderByDescending(x => x.Ts)
            .Take(cap)
            .ToListAsync();

        var result = rows.Select(ToDto).ToList();
        return Ok(result);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private static AuditEntry? _FromJson(JsonElement b)
    {
        if (b.ValueKind != JsonValueKind.Object) return null;
        return new AuditEntry
        {
            Id        = _Str(b, "id")      ?? "",
            Action    = _Str(b, "action"),
            Entity    = _Str(b, "entity"),
            Summary   = _Str(b, "summary"),
            ByName    = _Str(b, "by"),
            EmpId     = _Str(b, "empId"),
            Role      = _Str(b, "role"),
            RefType   = _Str(b, "refType"),
            RefId     = _Str(b, "refId"),
            Time      = _Str(b, "time"),
            Iso       = _Str(b, "iso"),
            Ts        = _Long(b, "ts"),
            CreatedAt = DateTime.UtcNow
        };
    }

    private static string? _Str(JsonElement b, string prop)
    {
        if (!b.TryGetProperty(prop, out var el)) return null;
        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.GetRawText(),
            JsonValueKind.True   => "true",
            JsonValueKind.False  => "false",
            _ => null
        };
    }

    private static long _Long(JsonElement b, string prop)
    {
        if (!b.TryGetProperty(prop, out var el)) return 0;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt64(out var n)) return n;
        if (el.ValueKind == JsonValueKind.String && long.TryParse(el.GetString(), out var ns)) return ns;
        return 0;
    }

    private static Dictionary<string, object?> ToDto(AuditEntry e) => new()
    {
        ["id"]      = e.Id,
        ["action"]  = e.Action,
        ["entity"]  = e.Entity,
        ["summary"] = e.Summary,
        ["by"]      = e.ByName,
        ["empId"]   = e.EmpId,
        ["role"]    = e.Role,
        ["refType"] = e.RefType,
        ["refId"]   = e.RefId,
        ["time"]    = e.Time,
        ["iso"]     = e.Iso,
        ["ts"]      = e.Ts
    };
}
