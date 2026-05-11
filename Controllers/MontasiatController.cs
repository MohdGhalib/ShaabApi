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

        _db.Montasiat.Add(entity);
        await _db.SaveChangesAsync();

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

        _ApplyFields(entity, body);
        entity.Version++;

        await _db.SaveChangesAsync();
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, record = ToDto(entity) });
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var entity = await _db.Montasiat.FindAsync(id);
        if (entity == null) return NotFound(new { error = "not found", id });

        // Soft delete: merge { deleted: true } into the data JSON column
        entity.Data = RecordMapper.MergeDeletedFlag(entity.Data);
        entity.Version++;

        await _db.SaveChangesAsync();
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, id });
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
