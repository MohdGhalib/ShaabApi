using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Controllers;

/// <summary>
/// Phase 4a of migration #11 — read endpoint for inquiries.
/// Returns records in the same JSON shape the frontend already expects
/// (camelCase keys, extras merged from the `data` JSON column).
/// Frontend will switch to this in Phase 4b/4c.
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
