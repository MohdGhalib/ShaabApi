using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;
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

    public record BackfillImagesReq(int? MaxPerType);

    /// <summary>
    /// Migration #11 Phase 4 — convert existing base64 images into the files table.
    /// Walks per-record tables (inquiry.qualityPhoto, complaint.file, montasia.data.photoBase64)
    /// + Master_DB messages attachments + Employees photos. Each base64 → a files row, the field
    /// becomes /api/files/{id}. Idempotent: already-URL values are skipped. Re-run until counts=0.
    /// Tables are processed in batches (MaxPerType, default 50) to bound memory.
    /// </summary>
    [HttpPost("backfill-images")]
    [RequestSizeLimit(2_000_000)]
    public async Task<IActionResult> BackfillImages([FromBody] BackfillImagesReq? req)
    {
        if (!_IsAuthorized()) return Forbid();
        var sw = Stopwatch.StartNew();
        int limit = (req?.MaxPerType is int m && m > 0 && m <= 500) ? m : 50;

        int inq = await _BackfillInquiries(limit);
        int cmp = await _BackfillComplaints(limit);
        int mnt = await _BackfillMontasiat(limit);
        int msg = await _BackfillBlobMessages();
        int emp = await _BackfillEmployees();

        sw.Stop();
        var userEmpId = User.FindFirst("empId")?.Value ?? "?";
        Console.WriteLine($"[BACKFILL-IMG] by={userEmpId} inq={inq} cmp={cmp} mnt={mnt} msg={msg} emp={emp} in {sw.ElapsedMilliseconds}ms");

        bool tablesMaybeMore = inq == limit || cmp == limit || mnt == limit;
        return Ok(new
        {
            ok = true,
            converted = new { inquiries = inq, complaints = cmp, montasiat = mnt, messages = msg, employees = emp },
            batchLimit = limit,
            moreLikely = tablesMaybeMore,
            durationMs = sw.ElapsedMilliseconds,
            note = tablesMaybeMore
                ? "A table hit the batch limit — re-run this endpoint until all counts are 0."
                : "All base64 images migrated. Idempotent — re-running is safe (skips URLs)."
        });
    }

    /// <summary>Decode a base64/data-URL value → files row → return /api/files/{id}.
    /// Returns null if value is empty, already a URL, or not valid base64.</summary>
    private string? _StoreImageBlob(string? val, string refType, string? refId, string? createdBy)
    {
        if (string.IsNullOrWhiteSpace(val)) return null;
        var v = val.Trim();
        if (v.StartsWith("/api/files/") || v.StartsWith("api/files/")
            || v.StartsWith("http://") || v.StartsWith("https://")) return null; // already migrated

        string mime = "image/jpeg";
        string b64;
        if (v.StartsWith("data:"))
        {
            var comma = v.IndexOf(',');
            if (comma < 5) return null;
            var header = v.Substring(5, comma - 5);                 // between "data:" and ","
            var semi = header.IndexOf(';');
            var mm = (semi >= 0 ? header.Substring(0, semi) : header).Trim();
            if (!string.IsNullOrEmpty(mm)) mime = mm;
            b64 = v.Substring(comma + 1);
        }
        else b64 = v;

        b64 = b64.Replace("\n", "").Replace("\r", "").Replace(" ", "");
        if (b64.Length < 32) return null;                           // too short to be a real image
        byte[] bytes;
        try { bytes = Convert.FromBase64String(b64); }
        catch { return null; }                                      // not valid base64 — leave as-is
        if (bytes.Length == 0 || bytes.Length > 15 * 1024 * 1024) return null;

        var id = Guid.NewGuid().ToString("N");
        _db.Files.Add(new FileBlob
        {
            Id = id, Mime = mime, Data = bytes, SizeBytes = bytes.Length,
            RefType = refType, RefId = refId, CreatedBy = createdBy, CreatedAt = DateTime.UtcNow
        });
        return $"/api/files/{id}";
    }

    private static string? _SafeStr(JsonNode? n)
    {
        if (n is JsonValue v)
            return v.TryGetValue<string>(out var s) ? s : v.ToString();
        return null;
    }

    private async Task<int> _BackfillInquiries(int limit)
    {
        var rows = await _db.Inquiries
            .Where(i => i.QualityPhoto != null && i.QualityPhoto != ""
                && !i.QualityPhoto.StartsWith("/api/files/")
                && !i.QualityPhoto.StartsWith("api/files/")
                && !i.QualityPhoto.StartsWith("http"))
            .Take(limit).ToListAsync();
        int n = 0;
        foreach (var r in rows)
        {
            var url = _StoreImageBlob(r.QualityPhoto, "inquiry", r.Id.ToString(), r.AddedBy);
            if (url != null) { r.QualityPhoto = url; n++; }
        }
        if (n > 0) await _db.SaveChangesAsync();
        return n;
    }

    private async Task<int> _BackfillComplaints(int limit)
    {
        var rows = await _db.Complaints
            .Where(c => c.File != null && c.File != ""
                && !c.File.StartsWith("/api/files/")
                && !c.File.StartsWith("api/files/")
                && !c.File.StartsWith("http"))
            .Take(limit).ToListAsync();
        int n = 0;
        foreach (var r in rows)
        {
            var url = _StoreImageBlob(r.File, "complaint", r.Id.ToString(), r.AddedBy);
            if (url != null) { r.File = url; n++; }
        }
        if (n > 0) await _db.SaveChangesAsync();
        return n;
    }

    private async Task<int> _BackfillMontasiat(int limit)
    {
        var rows = await _db.Montasiat
            .Where(m => m.Data != null && m.Data.Contains("photoBase64"))
            .Take(limit).ToListAsync();
        int n = 0;
        foreach (var r in rows)
        {
            if (string.IsNullOrEmpty(r.Data)) continue;
            JsonNode? node;
            try { node = JsonNode.Parse(r.Data); } catch { continue; }
            if (node is not JsonObject obj) continue;
            var pb = _SafeStr(obj["photoBase64"]);
            var url = _StoreImageBlob(pb, "montasia", r.Id.ToString(), r.AddedBy);
            if (url == null) continue;
            obj.Remove("photoBase64");
            obj["photoUrl"] = url;
            r.Data = obj.ToJsonString();
            n++;
        }
        if (n > 0) await _db.SaveChangesAsync();
        return n;
    }

    private async Task<int> _BackfillBlobMessages()
    {
        var row = await _db.Storage.FindAsync("Shaab_Master_DB");
        if (row == null || string.IsNullOrEmpty(row.StoreValue)) return 0;
        JsonNode? root;
        try { root = JsonNode.Parse(row.StoreValue); } catch { return 0; }
        if (root is not JsonObject obj || obj["messages"] is not JsonArray msgs) return 0;

        int n = 0;
        foreach (var mNode in msgs)
        {
            if (mNode is not JsonObject mm || mm["attachments"] is not JsonArray atts) continue;
            foreach (var aNode in atts)
            {
                if (aNode is not JsonObject a) continue;
                var url = _StoreImageBlob(_SafeStr(a["dataUrl"]), "message", _SafeStr(mm["id"]), _SafeStr(mm["from"]));
                if (url != null) { a["dataUrl"] = url; n++; }
            }
        }
        if (n > 0) { row.StoreValue = root.ToJsonString(); row.Version += 1; await _db.SaveChangesAsync(); }
        return n;
    }

    private async Task<int> _BackfillEmployees()
    {
        var row = await _db.Storage.FindAsync("Shaab_Employees_DB");
        if (row == null || string.IsNullOrEmpty(row.StoreValue)) return 0;
        JsonNode? root;
        try { root = JsonNode.Parse(row.StoreValue); } catch { return 0; }
        if (root is not JsonArray emps) return 0;

        int n = 0;
        foreach (var eNode in emps)
        {
            if (eNode is not JsonObject e) continue;
            var url = _StoreImageBlob(_SafeStr(e["photo"]), "employee", _SafeStr(e["empId"]), _SafeStr(e["empId"]));
            if (url != null) { e["photo"] = url; n++; }
        }
        if (n > 0) { row.StoreValue = root.ToJsonString(); row.Version += 1; await _db.SaveChangesAsync(); }
        return n;
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
