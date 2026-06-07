using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
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

    public record RenameBranchReq(string? OldName, string? NewName);

    /// <summary>
    /// Rename a branch everywhere: per-record tables (montasiat/inquiries/complaints
    /// Branch column) + the Master_DB blob (record arrays' "branch" field and the
    /// branchInfo map key) + employees' assignedBranches. Idempotent.
    /// </summary>
    [HttpPost("rename-branch")]
    public async Task<IActionResult> RenameBranch([FromBody] RenameBranchReq req)
    {
        if (!_IsAuthorized()) return Forbid();

        var oldName = req?.OldName?.Trim();
        var newName = req?.NewName?.Trim();
        if (string.IsNullOrEmpty(oldName) || string.IsNullOrEmpty(newName))
            return BadRequest(new { error = "oldName and newName are required" });
        if (oldName == newName)
            return BadRequest(new { error = "oldName and newName are identical" });

        var sw = Stopwatch.StartNew();

        // 1) per-record tables (typed Branch column)
        int tMnt = await _db.Montasiat .Where(x => x.Branch == oldName).ExecuteUpdateAsync(s => s.SetProperty(x => x.Branch, newName));
        int tInq = await _db.Inquiries .Where(x => x.Branch == oldName).ExecuteUpdateAsync(s => s.SetProperty(x => x.Branch, newName));
        int tCmp = await _db.Complaints.Where(x => x.Branch == oldName).ExecuteUpdateAsync(s => s.SetProperty(x => x.Branch, newName));

        // 2) Master_DB blob: record arrays' "branch" field + branchInfo map key
        int bMaster = await _RenameInStorageBlob("Shaab_Master_DB", oldName, newName, isMaster: true);

        // 3) employees' assignedBranches array
        int bEmp = await _RenameInStorageBlob("Shaab_Employees_DB", oldName, newName, isMaster: false);

        sw.Stop();
        var userEmpId = User.FindFirst("empId")?.Value ?? "?";
        Console.WriteLine($"[RENAME-BRANCH] by={userEmpId} '{oldName}'→'{newName}' tablesM/I/C={tMnt}/{tInq}/{tCmp} blobMaster={bMaster} blobEmp={bEmp} in {sw.ElapsedMilliseconds}ms");

        return Ok(new
        {
            ok = true,
            oldName, newName,
            tables = new { montasiat = tMnt, inquiries = tInq, complaints = tCmp },
            blob   = new { master = bMaster, employees = bEmp },
            durationMs = sw.ElapsedMilliseconds,
            note = "Reload the app (Ctrl+Shift+R). Records keep their data; only the branch label changed."
        });
    }

    /// <summary>Rewrite branch occurrences inside a storage JSON blob. Returns #fields changed.
    /// Bumps the row Version so clients re-fetch and so a stale client can't silently clobber it.</summary>
    private async Task<int> _RenameInStorageBlob(string key, string oldName, string newName, bool isMaster)
    {
        var row = await _db.Storage.FindAsync(key);
        if (row == null || string.IsNullOrEmpty(row.StoreValue)) return 0;

        int changed = 0;
        JsonNode? root;
        try { root = JsonNode.Parse(row.StoreValue); }
        catch { return 0; }

        if (isMaster)
        {
            if (root is not JsonObject obj) return 0;
            foreach (var arrName in new[] { "montasiat", "inquiries", "complaints" })
            {
                if (obj[arrName] is JsonArray arr)
                    foreach (var item in arr)
                        if (item is JsonObject rec && rec["branch"] is JsonValue bv
                            && bv.TryGetValue<string>(out var b) && b == oldName)
                        { rec["branch"] = newName; changed++; }
            }
            // branchInfo: object keyed by branch name → rename the key, keep its value
            if (obj["branchInfo"] is JsonObject bi && bi.ContainsKey(oldName))
            {
                var v = bi[oldName]?.DeepClone();
                bi.Remove(oldName);
                if (!bi.ContainsKey(newName)) bi[newName] = v;
                changed++;
            }
        }
        else
        {
            // employees array: each emp may have assignedBranches: [..]
            if (root is JsonArray emps)
            {
                foreach (var e in emps)
                    if (e is JsonObject emp && emp["assignedBranches"] is JsonArray ab)
                        for (int i = 0; i < ab.Count; i++)
                            if (ab[i] is JsonValue av && av.TryGetValue<string>(out var s) && s == oldName)
                            { ab[i] = newName; changed++; }
            }
        }

        if (changed > 0)
        {
            row.StoreValue = root.ToJsonString();
            row.Version   += 1;
            await _db.SaveChangesAsync();
        }
        return changed;
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
