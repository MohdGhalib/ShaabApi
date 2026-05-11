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
/// for complaints.
/// </summary>
[ApiController]
[Route("api/complaints")]
[Authorize]
public class ComplaintsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ComplaintsController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rows = await _db.Complaints
            .OrderByDescending(c => c.Id)
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

        var existing = await _db.Complaints.FindAsync(id);
        if (existing != null)
            return Conflict(new { error = "id already exists", id });

        var entity = new Complaint { Id = id, Version = 1, CreatedAt = DateTime.UtcNow };
        _ApplyFields(entity, body);

        _db.Complaints.Add(entity);
        await _db.SaveChangesAsync();

        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, record = ToDto(entity) });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "body must be a JSON object" });

        var entity = await _db.Complaints.FindAsync(id);
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
        var entity = await _db.Complaints.FindAsync(id);
        if (entity == null) return NotFound(new { error = "not found", id });

        entity.Data = RecordMapper.MergeDeletedFlag(entity.Data);
        entity.Version++;

        await _db.SaveChangesAsync();
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, id });
    }

    private static readonly HashSet<string> _typedFields = new(StringComparer.Ordinal)
    {
        "id", "branch", "notes", "time", "iso", "file", "addedBy"
    };

    private static void _ApplyFields(Complaint e, JsonElement body)
    {
        e.Branch  = RecordMapper.GetStringOrNull(body, "branch",  100);
        e.Notes   = RecordMapper.GetStringOrNull(body, "notes",   int.MaxValue);
        e.Time    = RecordMapper.GetStringOrNull(body, "time",    50);
        e.Iso     = RecordMapper.GetStringOrNull(body, "iso",     50);
        e.File    = RecordMapper.GetStringOrNull(body, "file",    int.MaxValue);
        e.AddedBy = RecordMapper.GetStringOrNull(body, "addedBy", 100);
        e.Data    = RecordMapper.ExtractExtraFields(body, _typedFields);
    }

    public static Dictionary<string, object?> ToDto(Complaint c)
    {
        var dict = new Dictionary<string, object?>
        {
            ["id"]      = c.Id,
            ["branch"]  = c.Branch,
            ["notes"]   = c.Notes,
            ["time"]    = c.Time,
            ["iso"]     = c.Iso,
            ["file"]    = c.File,
            ["addedBy"] = c.AddedBy
        };
        DtoHelper.MergeDataExtras(c.Data, dict);
        return dict;
    }
}
