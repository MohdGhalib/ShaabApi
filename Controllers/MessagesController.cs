using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Controllers;

/// <summary>
/// Internal employee messages stored in their own table (off the Master_DB blob) so
/// they never bloat saves and can't be clobbered by full-blob writes. POST appends one
/// message (idempotent on id); bulk for one-time migration; PATCH toggles read/deleted;
/// GET returns messages newest-first. Visibility (mine vs. oversight) is enforced on the
/// client — consistent with the rest of this app, which ships all data to every client.
/// </summary>
[ApiController]
[Route("api/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _db;
    public MessagesController(AppDbContext db) { _db = db; }

    /// <summary>Append one message. Idempotent on id (duplicate ids ignored).</summary>
    [HttpPost]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> Add([FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "body must be a JSON object" });

        var m = _FromJson(body);
        if (m == null || m.Id == 0)
            return BadRequest(new { error = "id required" });

        var exists = await _db.Messages.AnyAsync(x => x.Id == m.Id);
        if (!exists)
        {
            _db.Messages.Add(m);
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { /* duplicate id inserted concurrently — treat as success */ }
        }
        return Ok(new { ok = true, id = m.Id });
    }

    /// <summary>Bulk insert (one-time migration of in-blob messages). Skips existing ids.</summary>
    [HttpPost("bulk")]
    [RequestSizeLimit(40_000_000)]
    public async Task<IActionResult> AddBulk([FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Array)
            return BadRequest(new { error = "body must be a JSON array" });

        var incoming = new List<Message>();
        foreach (var el in body.EnumerateArray())
        {
            var m = _FromJson(el);
            if (m != null && m.Id != 0) incoming.Add(m);
        }
        if (incoming.Count == 0) return Ok(new { ok = true, added = 0 });

        var ids = incoming.Select(x => x.Id).ToList();
        var existing = (await _db.Messages.Where(x => ids.Contains(x.Id)).Select(x => x.Id).ToListAsync()).ToHashSet();

        int added = 0;
        foreach (var m in incoming)
        {
            if (existing.Contains(m.Id)) continue;
            existing.Add(m.Id);          // guard against duplicate ids within the same payload
            _db.Messages.Add(m);
            added++;
        }
        if (added > 0)
        {
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { /* overlapping ids across concurrent bulks — best-effort */ }
        }
        return Ok(new { ok = true, added });
    }

    /// <summary>Toggle read/deleted flags. Both monotonic-friendly; only ever set true here.</summary>
    [HttpPatch("{id:long}")]
    public async Task<IActionResult> Patch(long id, [FromBody] JsonElement body)
    {
        var row = await _db.Messages.FirstOrDefaultAsync(x => x.Id == id);
        if (row == null) return Ok(new { ok = true, id, missing = true }); // tolerate races

        if (body.TryGetProperty("readByMe", out var r) && (r.ValueKind == JsonValueKind.True || r.ValueKind == JsonValueKind.False))
            row.ReadByMe = r.GetBoolean();
        if (body.TryGetProperty("deleted", out var d) && (d.ValueKind == JsonValueKind.True || d.ValueKind == JsonValueKind.False))
            row.Deleted = d.GetBoolean();

        row.Version++;
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { /* another writer won — its value stands */ }
        return Ok(new { ok = true, id });
    }

    /// <summary>Return messages with ts >= sinceTs (default: last 90 days), newest first.</summary>
    [HttpGet]
    public async Task<IActionResult> GetRange([FromQuery] long? sinceTs, [FromQuery] int? limit)
    {
        long from = sinceTs ?? DateTimeOffset.UtcNow.AddDays(-90).ToUnixTimeMilliseconds();
        int  cap  = (limit is int l && l > 0 && l <= 20000) ? l : 10000;

        var rows = await _db.Messages
            .Where(x => x.Ts >= from)
            .OrderByDescending(x => x.Ts)
            .Take(cap)
            .ToListAsync();

        var result = rows.Select(ToDto).ToList();
        return Ok(result);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private static Message? _FromJson(JsonElement b)
    {
        if (b.ValueKind != JsonValueKind.Object) return null;
        long id = _Long(b, "id");
        if (id == 0) return null;
        return new Message
        {
            Id             = id,
            FromName       = _Str(b, "from"),
            ToName         = _Str(b, "to"),
            Text           = _Str(b, "text"),
            Ts             = _Long(b, "ts"),
            ReadByMe       = _Bool(b, "readByMe"),
            Deleted        = _Bool(b, "deleted"),
            IsIntervention = _Bool(b, "isIntervention"),
            Data           = b.GetRawText(),   // keep the full original object verbatim
            CreatedAt      = DateTime.UtcNow
        };
    }

    // Build the client object from the stored full `data`, overlaying the authoritative
    // mutable flags (read/deleted) from columns so PATCHes are reflected without rewriting data.
    private static object ToDto(Message m)
    {
        JsonObject obj;
        try
        {
            obj = (string.IsNullOrEmpty(m.Data) ? null : JsonNode.Parse(m.Data)) as JsonObject ?? new JsonObject();
        }
        catch { obj = new JsonObject(); }

        obj["id"]       = m.Id;
        obj["from"]     = m.FromName;
        obj["to"]       = m.ToName;
        obj["ts"]       = m.Ts;
        obj["readByMe"] = m.ReadByMe;
        obj["deleted"]  = m.Deleted;
        return obj;
    }

    private static string? _Str(JsonElement b, string prop)
    {
        if (!b.TryGetProperty(prop, out var el)) return null;
        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.GetRawText(),
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

    private static bool _Bool(JsonElement b, string prop)
    {
        if (!b.TryGetProperty(prop, out var el)) return false;
        return el.ValueKind == JsonValueKind.True;
    }
}
