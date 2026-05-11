using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Controllers;

/// <summary>
/// Phase 4a of migration #11 — read endpoint for montasiat.
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
