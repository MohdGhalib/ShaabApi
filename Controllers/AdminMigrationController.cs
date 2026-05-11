using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Services;

namespace ShaabApi.Controllers;

/// <summary>
/// Phase 3 of migration #11 — backfill + verification endpoints.
/// Lets an admin / cc_manager manually trigger a full sync from the
/// Master_DB JSON blob into the per-record tables, and verify that
/// counts and IDs match between the two representations.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize]
public class AdminMigrationController : ControllerBase
{
    private readonly AppDbContext         _db;
    private readonly PerRecordSyncService _sync;

    public AdminMigrationController(AppDbContext db, PerRecordSyncService sync)
    {
        _db   = db;
        _sync = sync;
    }

    /// <summary>
    /// One-shot backfill: read Master_DB JSON and upsert every record
    /// into the per-record tables. Idempotent — safe to re-run.
    /// </summary>
    [HttpPost("backfill-tables")]
    public async Task<IActionResult> BackfillTables()
    {
        if (!_IsAuthorized()) return Forbid();

        var sw = Stopwatch.StartNew();

        var row = await _db.Storage.FindAsync("Shaab_Master_DB");
        if (row == null || string.IsNullOrEmpty(row.StoreValue))
            return BadRequest(new { error = "Master_DB is empty or missing" });

        var (inq, mnt, cmp) = await _sync.SyncMasterDbAsync(row.StoreValue);
        sw.Stop();

        var userEmpId = User.FindFirst("empId")?.Value ?? "?";
        Console.WriteLine($"[BACKFILL] triggered by={userEmpId} I={inq} M={mnt} C={cmp} in {sw.ElapsedMilliseconds}ms");

        return Ok(new
        {
            ok          = true,
            inquiries   = inq,
            montasiat   = mnt,
            complaints  = cmp,
            durationMs  = sw.ElapsedMilliseconds
        });
    }

    /// <summary>
    /// Compare counts and IDs between Master_DB JSON and per-record tables.
    /// Returns mismatches so you can decide whether to re-run backfill.
    /// </summary>
    [HttpGet("verify-tables")]
    public async Task<IActionResult> VerifyTables()
    {
        if (!_IsAuthorized()) return Forbid();

        var row = await _db.Storage.FindAsync("Shaab_Master_DB");
        if (row == null || string.IsNullOrEmpty(row.StoreValue))
            return BadRequest(new { error = "Master_DB is empty or missing" });

        var blobIds   = _CollectBlobIds(row.StoreValue);
        HashSet<long> blobInq = blobIds.inquiries;
        HashSet<long> blobMnt = blobIds.montasiat;
        HashSet<long> blobCmp = blobIds.complaints;

        var inqIds = (await _db.Inquiries .Select(i => i.Id).ToListAsync()).ToHashSet();
        var mntIds = (await _db.Montasiat .Select(m => m.Id).ToListAsync()).ToHashSet();
        var cmpIds = (await _db.Complaints.Select(c => c.Id).ToListAsync()).ToHashSet();

        long[] missingInq = blobInq.Except(inqIds).Take(50).ToArray();
        long[] missingMnt = blobMnt.Except(mntIds).Take(50).ToArray();
        long[] missingCmp = blobCmp.Except(cmpIds).Take(50).ToArray();

        long[] extraInq = inqIds.Except(blobInq).Take(50).ToArray();
        long[] extraMnt = mntIds.Except(blobMnt).Take(50).ToArray();
        long[] extraCmp = cmpIds.Except(blobCmp).Take(50).ToArray();

        int jBlobInq = blobInq.Count, jBlobMnt = blobMnt.Count, jBlobCmp = blobCmp.Count;
        int dbInq    = inqIds.Count,  dbMnt    = mntIds.Count,  dbCmp    = cmpIds.Count;

        bool match =
            missingInq.Length == 0 && extraInq.Length == 0 &&
            missingMnt.Length == 0 && extraMnt.Length == 0 &&
            missingCmp.Length == 0 && extraCmp.Length == 0;

        return Ok(new
        {
            jsonBlob   = new { inquiries = jBlobInq, montasiat = jBlobMnt, complaints = jBlobCmp },
            perRecord  = new { inquiries = dbInq,    montasiat = dbMnt,    complaints = dbCmp    },
            match,
            missingIds = new { inquiries = missingInq, montasiat = missingMnt, complaints = missingCmp }, // in blob, not in table — need backfill
            extraIds   = new { inquiries = extraInq,   montasiat = extraMnt,   complaints = extraCmp   }  // in table, not in blob — possible orphans
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private bool _IsAuthorized()
    {
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        var role    = User.FindFirst("role")?.Value ?? "";
        return isAdmin || role == "cc_manager";
    }

    private static (HashSet<long> inquiries, HashSet<long> montasiat, HashSet<long> complaints) _CollectBlobIds(string json)
    {
        var inq = new HashSet<long>();
        var mnt = new HashSet<long>();
        var cmp = new HashSet<long>();
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return (inq, mnt, cmp);

            _CollectArrayIds(root, "inquiries",  inq);
            _CollectArrayIds(root, "montasiat",  mnt);
            _CollectArrayIds(root, "complaints", cmp);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[VERIFY] JSON parse failed: {ex.Message}");
        }
        return (inq, mnt, cmp);
    }

    private static void _CollectArrayIds(JsonElement root, string prop, HashSet<long> ids)
    {
        if (!root.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array) return;
        foreach (var rec in arr.EnumerateArray())
        {
            if (rec.ValueKind != JsonValueKind.Object) continue;
            if (!rec.TryGetProperty("id", out var idEl)) continue;
            long id;
            if (idEl.ValueKind == JsonValueKind.Number && idEl.TryGetInt64(out id)) ids.Add(id);
            else if (idEl.ValueKind == JsonValueKind.String && long.TryParse(idEl.GetString(), out id)) ids.Add(id);
        }
    }
}
