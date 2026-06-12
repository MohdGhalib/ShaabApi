using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Controllers;

/// <summary>
/// "ملاحظات مدراء مناطق" stored in their own table (off the Master_DB blob). POST appends one
/// note (idempotent on id); PATCH edits fields / closes (with closing note) / soft-deletes;
/// GET returns notes newest-first. Visibility (call-center staff only) is enforced on the
/// client — consistent with the rest of this app, which ships all data to every client.
/// </summary>
[ApiController]
[Route("api/managerNotes")]
[Authorize]
public class ManagerNotesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ManagerNotesController(AppDbContext db) { _db = db; }

    /// <summary>Append one note. Idempotent on id (duplicate ids ignored).</summary>
    [HttpPost]
    [RequestSizeLimit(2_000_000)]
    public async Task<IActionResult> Add([FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "body must be a JSON object" });

        var n = _FromJson(body);
        if (n == null || n.Id == 0)
            return BadRequest(new { error = "id required" });

        var exists = await _db.ManagerNotes.AnyAsync(x => x.Id == n.Id);
        if (!exists)
        {
            _db.ManagerNotes.Add(n);
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { /* duplicate id inserted concurrently — treat as success */ }
        }
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, id = n.Id });
    }

    /// <summary>
    /// Patch a note: edit any field (branch/date/notifiedPerson/text/addedBy/closeNote/
    /// closedBy/closedAt), close OR reopen it (closed is bidirectional), or soft-delete it.
    /// Only provided properties are touched. Deleted stays monotonic (only ever set true).
    /// Every patch stamps updated_ts so the client's last-write-wins merge keeps the edit.
    /// </summary>
    [HttpPatch("{id:long}")]
    public async Task<IActionResult> Patch(long id, [FromBody] JsonElement body)
    {
        var row = await _db.ManagerNotes.FirstOrDefaultAsync(x => x.Id == id);
        if (row == null)
        {
            // 🛡️ upsert: the original POST may have been lost (deploy race / network blip / the
            // PATCH outran the not-yet-committed insert). The client sends the full note on close,
            // so create it now (with whatever close flags the body carries) instead of dropping it.
            var created = _FromJson(body);
            if (created != null && created.Id == id)
            {
                _db.ManagerNotes.Add(created);
                try { await _db.SaveChangesAsync(); }
                catch (DbUpdateException) { /* inserted concurrently — fine */ }
                _ = SseController.Broadcast("reload", "1");
                return Ok(new { ok = true, id, created = true });
            }
            return Ok(new { ok = true, id, missing = true }); // partial body, nothing to create
        }

        // ── editable fields (applied only when present in the body) ──
        if (_TryStr(body, "branch",         out var br)) row.Branch         = _Cap(br, 100);
        if (_TryStr(body, "noteDate",       out var nd)) row.NoteDate       = _Cap(nd, 30);
        if (_TryStr(body, "notifiedPerson", out var np)) row.NotifiedPerson = _Cap(np, 150);
        if (_TryStr(body, "text",           out var tx)) row.Text           = tx;
        if (_TryStr(body, "addedBy",        out var ab)) row.AddedBy        = _Cap(ab, 100);
        if (_TryStr(body, "closeNote",      out var cn)) row.CloseNote      = cn;
        if (_TryStr(body, "closedBy",       out var cb)) row.ClosedBy       = _Cap(cb, 100);
        if (body.TryGetProperty("closedAt", out var caEl) && caEl.ValueKind == JsonValueKind.Number)
            row.ClosedAt = _Long(body, "closedAt");

        // ── closed is bidirectional: supports both close and إلغاء الإغلاق (reopen) ──
        if (body.TryGetProperty("closed", out var c) &&
            (c.ValueKind == JsonValueKind.True || c.ValueKind == JsonValueKind.False))
            row.Closed = c.ValueKind == JsonValueKind.True;

        // ── deleted stays monotonic (only ever set true here) ──
        if (body.TryGetProperty("deleted", out var d) && d.ValueKind == JsonValueKind.True)
            row.Deleted = true;

        // ── last-write-wins stamp for the client merge (fallback to server time) ──
        var uts = _Long(body, "updatedTs");
        row.UpdatedTs = uts != 0 ? uts : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        row.Version++;
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { /* another writer won — its value stands */ }
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, id });
    }

    /// <summary>Return notes (default: all, newest first).</summary>
    [HttpGet]
    public async Task<IActionResult> GetRange([FromQuery] long? sinceTs, [FromQuery] int? limit)
    {
        long from = sinceTs ?? 0;
        int  cap  = (limit is int l && l > 0 && l <= 20000) ? l : 20000;

        var rows = await _db.ManagerNotes
            .Where(x => x.Ts >= from)
            .OrderByDescending(x => x.Ts)
            .Take(cap)
            .ToListAsync();

        return Ok(rows.Select(ToDto).ToList());
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private static ManagerNote? _FromJson(JsonElement b)
    {
        if (b.ValueKind != JsonValueKind.Object) return null;
        long id = _Long(b, "id");
        if (id == 0) return null;
        return new ManagerNote
        {
            Id             = id,
            Branch         = _Cap(_Str(b, "branch"),         100),
            NoteDate       = _Cap(_Str(b, "noteDate"),       30),
            NotifiedPerson = _Cap(_Str(b, "notifiedPerson"), 150),
            Text           = _Str(b, "text"),
            Closed         = _Bool(b, "closed"),
            CloseNote      = _Str(b, "closeNote"),
            ClosedBy       = _Cap(_Str(b, "closedBy"), 100),
            ClosedAt       = _Long(b, "closedAt"),
            AddedBy        = _Cap(_Str(b, "addedBy"), 100),
            Ts             = _Long(b, "ts"),
            UpdatedTs      = _Long(b, "updatedTs"),
            Deleted        = _Bool(b, "deleted"),
            Data           = b.GetRawText(),
            CreatedAt      = DateTime.UtcNow
        };
    }

    private static object ToDto(ManagerNote n)
    {
        JsonObject obj;
        try { obj = (string.IsNullOrEmpty(n.Data) ? null : JsonNode.Parse(n.Data)) as JsonObject ?? new JsonObject(); }
        catch { obj = new JsonObject(); }

        obj["id"]             = n.Id;
        obj["branch"]         = n.Branch;
        obj["noteDate"]       = n.NoteDate;
        obj["notifiedPerson"] = n.NotifiedPerson;
        obj["text"]           = n.Text;
        obj["closed"]         = n.Closed;
        obj["closeNote"]      = n.CloseNote;
        obj["closedBy"]       = n.ClosedBy;
        obj["closedAt"]       = n.ClosedAt;
        obj["addedBy"]        = n.AddedBy;
        obj["ts"]             = n.Ts;
        obj["updatedTs"]      = n.UpdatedTs;
        obj["deleted"]        = n.Deleted;
        return obj;
    }

    private static string? _Cap(string? s, int max)
        => (s != null && s.Length > max) ? s.Substring(0, max) : s;

    private static bool _TryStr(JsonElement b, string prop, out string? val)
    {
        val = null;
        if (!b.TryGetProperty(prop, out var el)) return false;
        if (el.ValueKind == JsonValueKind.String) { val = el.GetString(); return true; }
        if (el.ValueKind == JsonValueKind.Number) { val = el.GetRawText(); return true; }
        return false;
    }

    private static string? _Str(JsonElement b, string prop)
        => _TryStr(b, prop, out var v) ? v : null;

    private static long _Long(JsonElement b, string prop)
    {
        if (!b.TryGetProperty(prop, out var el)) return 0;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt64(out var n)) return n;
        if (el.ValueKind == JsonValueKind.String && long.TryParse(el.GetString(), out var ns)) return ns;
        return 0;
    }

    private static bool _Bool(JsonElement b, string prop)
        => b.TryGetProperty(prop, out var el) && el.ValueKind == JsonValueKind.True;
}
