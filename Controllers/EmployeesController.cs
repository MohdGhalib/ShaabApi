using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;
using ShaabApi.Services;

namespace ShaabApi.Controllers;

/// <summary>
/// Read-only per-record employees endpoint (shadow of Shaab_Employees_DB).
/// Auth + employee writes still go through the blob; this just lets clients read
/// the roster/branches without pulling the whole blob. Secrets (salt/passwordHash)
/// are never returned. Lazily backfills from the blob on first read.
/// </summary>
[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly AppDbContext        _db;
    private readonly EmployeeSyncService _sync;

    public EmployeesController(AppDbContext db, EmployeeSyncService sync)
    {
        _db   = db;
        _sync = sync;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        // self-healing: if the shadow table is empty, populate it from the blob once
        if (!await _db.Employees.AnyAsync())
        {
            var row = await _db.Storage.FindAsync("Shaab_Employees_DB");
            if (row != null && !string.IsNullOrEmpty(row.StoreValue))
                await _sync.SyncFromBlobAsync(row.StoreValue);
        }

        var rows = await _db.Employees.ToListAsync();
        var result = rows.Select(ToDto).ToList();
        return Ok(result);
    }

    // secrets (salt/passwordHash) intentionally omitted from the API surface
    private static Dictionary<string, object?> ToDto(Employee e)
    {
        var dict = new Dictionary<string, object?>
        {
            ["empId"] = e.EmpId,
            ["name"]  = e.Name,
            ["title"] = e.Title
        };
        DtoHelper.MergeDataExtras(e.Data, dict);
        return dict;
    }
}
