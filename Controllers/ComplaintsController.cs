using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Controllers;

/// <summary>
/// Phase 4a of migration #11 — read endpoint for complaints.
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
