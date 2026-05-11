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
/// for inquiries.
/// </summary>
[ApiController]
[Route("api/inquiries")]
[Authorize]
public class InquiriesController : ControllerBase
{
    private readonly AppDbContext _db;
    public InquiriesController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rows = await _db.Inquiries
            .OrderByDescending(i => i.Id)
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

        var existing = await _db.Inquiries.FindAsync(id);
        if (existing != null)
            return Conflict(new { error = "id already exists", id });

        var entity = new Inquiry { Id = id, Version = 1, CreatedAt = DateTime.UtcNow };
        _ApplyFields(entity, body);

        _db.Inquiries.Add(entity);
        await _db.SaveChangesAsync();

        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, record = ToDto(entity) });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "body must be a JSON object" });

        var entity = await _db.Inquiries.FindAsync(id);
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
        var entity = await _db.Inquiries.FindAsync(id);
        if (entity == null) return NotFound(new { error = "not found", id });

        entity.Data = RecordMapper.MergeDeletedFlag(entity.Data);
        entity.Version++;

        await _db.SaveChangesAsync();
        _ = SseController.Broadcast("reload", "1");
        return Ok(new { ok = true, id });
    }

    private static readonly HashSet<string> _typedFields = new(StringComparer.Ordinal)
    {
        "id", "seq", "city", "branch", "phone", "type", "notes",
        "itemName", "offerName", "qualityPhoto", "time", "iso", "addedBy"
    };

    private static void _ApplyFields(Inquiry e, JsonElement body)
    {
        e.Seq          = RecordMapper.GetIntOrNull(body, "seq");
        e.City         = RecordMapper.GetStringOrNull(body, "city",         100);
        e.Branch       = RecordMapper.GetStringOrNull(body, "branch",       100);
        e.Phone        = RecordMapper.GetStringOrNull(body, "phone",        30);
        e.Type         = RecordMapper.GetStringOrNull(body, "type",         50);
        e.Notes        = RecordMapper.GetStringOrNull(body, "notes",        int.MaxValue);
        e.ItemName     = RecordMapper.GetStringOrNull(body, "itemName",     200);
        e.OfferName    = RecordMapper.GetStringOrNull(body, "offerName",    200);
        e.QualityPhoto = RecordMapper.GetStringOrNull(body, "qualityPhoto", int.MaxValue);
        e.Time         = RecordMapper.GetStringOrNull(body, "time",         50);
        e.Iso          = RecordMapper.GetStringOrNull(body, "iso",          50);
        e.AddedBy      = RecordMapper.GetStringOrNull(body, "addedBy",      100);
        e.Data         = RecordMapper.ExtractExtraFields(body, _typedFields);
    }

    public static Dictionary<string, object?> ToDto(Inquiry i)
    {
        var dict = new Dictionary<string, object?>
        {
            ["id"]            = i.Id,
            ["seq"]           = i.Seq,
            ["city"]          = i.City,
            ["branch"]        = i.Branch,
            ["phone"]         = i.Phone,
            ["type"]          = i.Type,
            ["notes"]         = i.Notes,
            ["itemName"]      = i.ItemName,
            ["offerName"]     = i.OfferName,
            ["qualityPhoto"]  = i.QualityPhoto,
            ["time"]          = i.Time,
            ["iso"]           = i.Iso,
            ["addedBy"]       = i.AddedBy
        };
        DtoHelper.MergeDataExtras(i.Data, dict);
        return dict;
    }
}
