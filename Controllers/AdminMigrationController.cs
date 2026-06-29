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
    /// One-shot cleanup after removing the control + media departments and the
    /// complaints/compensations feature. Deletes control/media employees (blob +
    /// table), clears complaints/auditNotes/compensations from the blobs, and drops
    /// the legacy complaints table. Admin / cc_manager only. Idempotent.
    /// </summary>
    [HttpPost("cleanup-control-media")]
    public async Task<IActionResult> CleanupControlMedia()
    {
        if (!_IsAuthorized()) return Forbid();

        var removedTitles = new[] { "قسم السيطرة", "موظف ميديا", "مدير قسم السيطرة", "موظف سيطرة" };
        int empBlob = 0, empTable = 0, complaints = 0, auditNotes = 0, comps = 0;

        // 1) employees blob (Shaab_Employees_DB is a JSON array)
        var empRow = await _db.Storage.FindAsync("Shaab_Employees_DB");
        if (empRow != null && !string.IsNullOrEmpty(empRow.StoreValue))
        {
            try
            {
                if (JsonNode.Parse(empRow.StoreValue) is JsonArray arr)
                {
                    var keep = new JsonArray();
                    foreach (var item in arr)
                    {
                        var title = item?["title"]?.GetValue<string>() ?? "";
                        if (System.Array.IndexOf(removedTitles, title) >= 0) { empBlob++; continue; }
                        keep.Add(item!.DeepClone());
                    }
                    if (empBlob > 0)
                    {
                        empRow.StoreValue = keep.ToJsonString();
                        empRow.Version += 1;
                        empRow.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }
            catch (Exception ex) { Console.WriteLine($"[CLEANUP] employees blob: {ex.Message}"); }
        }

        // 2) employees shadow table
        try
        {
            var emps = await _db.Employees.Where(e => removedTitles.Contains(e.Title)).ToListAsync();
            empTable = emps.Count;
            if (emps.Count > 0) _db.Employees.RemoveRange(emps);
        }
        catch (Exception ex) { Console.WriteLine($"[CLEANUP] employees table: {ex.Message}"); }

        // 3) Master_DB blob: clear complaints[] + auditNotes[] (+ compensations[] if present)
        var masterRow = await _db.Storage.FindAsync("Shaab_Master_DB");
        if (masterRow != null && !string.IsNullOrEmpty(masterRow.StoreValue))
        {
            try
            {
                if (JsonNode.Parse(masterRow.StoreValue) is JsonObject obj)
                {
                    if (obj["complaints"]    is JsonArray a1) { complaints = a1.Count; obj["complaints"]    = new JsonArray(); }
                    if (obj["auditNotes"]    is JsonArray a2) { auditNotes = a2.Count; obj["auditNotes"]    = new JsonArray(); }
                    if (obj["compensations"] is JsonArray a3) { comps     += a3.Count; obj["compensations"] = new JsonArray(); }
                    masterRow.StoreValue = obj.ToJsonString();
                    masterRow.Version += 1;
                    masterRow.UpdatedAt = DateTime.UtcNow;
                }
            }
            catch (Exception ex) { Console.WriteLine($"[CLEANUP] master blob: {ex.Message}"); }
        }

        // 4) compensations blob (separate key)
        var compRow = await _db.Storage.FindAsync("Shaab_Compensations_DB");
        if (compRow != null && !string.IsNullOrEmpty(compRow.StoreValue))
        {
            try { if (JsonNode.Parse(compRow.StoreValue) is JsonArray ca) comps += ca.Count; } catch { }
            compRow.StoreValue = "[]";
            compRow.Version += 1;
            compRow.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        // 5) drop legacy complaints table
        try { await _db.Database.ExecuteSqlRawAsync("DROP TABLE IF EXISTS complaints"); }
        catch (Exception ex) { Console.WriteLine($"[CLEANUP] drop complaints table: {ex.Message}"); }

        var by = User.FindFirst("empId")?.Value ?? "?";
        Console.WriteLine($"[CLEANUP] by={by} empBlob={empBlob} empTable={empTable} complaints={complaints} auditNotes={auditNotes} comps={comps}");
        return Ok(new {
            ok = true,
            employeesRemovedFromBlob  = empBlob,
            employeesRemovedFromTable = empTable,
            complaintsCleared = complaints,
            auditNotesCleared = auditNotes,
            compensationsCleared = comps,
            note = "أعد تحميل التطبيق (Ctrl+Shift+R). حُذفت حسابات السيطرة/الميديا وبيانات الشكاوى/التعويضات."
        });
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

        var inqIds = (await _db.Inquiries .Select(i => i.Id).ToListAsync()).ToHashSet();
        var mntIds = (await _db.Montasiat .Select(m => m.Id).ToListAsync()).ToHashSet();

        long[] missingInq = blobInq.Except(inqIds).Take(50).ToArray();
        long[] missingMnt = blobMnt.Except(mntIds).Take(50).ToArray();

        long[] extraInq = inqIds.Except(blobInq).Take(50).ToArray();
        long[] extraMnt = mntIds.Except(blobMnt).Take(50).ToArray();

        int jBlobInq = blobInq.Count, jBlobMnt = blobMnt.Count;
        int dbInq    = inqIds.Count,  dbMnt    = mntIds.Count;

        bool match =
            missingInq.Length == 0 && extraInq.Length == 0 &&
            missingMnt.Length == 0 && extraMnt.Length == 0;

        return Ok(new
        {
            jsonBlob   = new { inquiries = jBlobInq, montasiat = jBlobMnt },
            perRecord  = new { inquiries = dbInq,    montasiat = dbMnt    },
            match,
            missingIds = new { inquiries = missingInq, montasiat = missingMnt }, // in blob, not in table — need backfill
            extraIds   = new { inquiries = extraInq,   montasiat = extraMnt   }  // in table, not in blob — possible orphans
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

        // 2) Master_DB blob: record arrays' "branch" field + branchInfo map key
        int bMaster = await _RenameInStorageBlob("Shaab_Master_DB", oldName, newName, isMaster: true);

        // 3) employees' assignedBranches array
        int bEmp = await _RenameInStorageBlob("Shaab_Employees_DB", oldName, newName, isMaster: false);

        sw.Stop();
        var userEmpId = User.FindFirst("empId")?.Value ?? "?";
        Console.WriteLine($"[RENAME-BRANCH] by={userEmpId} '{oldName}'→'{newName}' tablesM/I={tMnt}/{tInq} blobMaster={bMaster} blobEmp={bEmp} in {sw.ElapsedMilliseconds}ms");

        return Ok(new
        {
            ok = true,
            oldName, newName,
            tables = new { montasiat = tMnt, inquiries = tInq },
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
            foreach (var arrName in new[] { "montasiat", "inquiries" })
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
                if (!bi.ContainsKey(newName))
                {
                    bi[newName] = v;
                }
                else
                {
                    // الهدف موجود مسبقاً = دمج وليس إعادة تسمية. لا نطمس إعداد الهدف،
                    // لكن نُسجّل تحذيراً صريحاً بدل فقدان إعداد الفرع القديم بصمت.
                    Console.WriteLine($"[RENAME-BRANCH] ⚠ branchInfo merge: target '{newName}' already exists — kept target config, discarded source '{oldName}' config.");
                }
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
        int mnt = await _BackfillMontasiat(limit);
        int msg = await _BackfillBlobMessages();
        int emp = await _BackfillEmployees();

        sw.Stop();
        var userEmpId = User.FindFirst("empId")?.Value ?? "?";
        Console.WriteLine($"[BACKFILL-IMG] by={userEmpId} inq={inq} mnt={mnt} msg={msg} emp={emp} in {sw.ElapsedMilliseconds}ms");

        bool tablesMaybeMore = inq == limit || mnt == limit;
        return Ok(new
        {
            ok = true,
            converted = new { inquiries = inq, montasiat = mnt, messages = msg, employees = emp },
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
            try
            {
                var url = _StoreImageBlob(r.QualityPhoto, "inquiry", r.Id.ToString(), r.AddedBy);
                if (url != null) { r.QualityPhoto = url; n++; }
            }
            catch (Exception ex) { Console.WriteLine($"[BACKFILL-IMG] inquiry {r.Id} skip: {ex.Message}"); }
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
            try
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
            catch (Exception ex) { Console.WriteLine($"[BACKFILL-IMG] montasia {r.Id} skip: {ex.Message}"); }
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

    /// <summary>
    /// One-time repair (2026-06-10): find montasiat sharing the same reference number
    /// (serial, e.g. 261963) and renumber the NEWER duplicates — the oldest record (smallest
    /// id) keeps the number. Also nulls out empty-string serials so the unique index can build.
    /// Dry-run by default; pass ?apply=true to write changes and create ux_montasiat_serial.
    /// </summary>
    [HttpPost("dedupe-montasiat-serials")]
    public async Task<IActionResult> DedupeMontasiatSerials([FromQuery] bool apply = false)
    {
        if (!_IsAuthorized()) return Forbid();
        var sw = Stopwatch.StartNew();

        // smallest id first = oldest = keeps its serial (ids are Date.now()-based)
        var all = await _db.Montasiat
            .OrderBy(m => m.Id)
            .Select(m => new { m.Id, m.Serial, m.Iso })
            .ToListAsync();

        // every normalized non-empty serial currently in use (across all years)
        var used = new HashSet<string>(StringComparer.Ordinal);
        foreach (var m in all)
        {
            var s = MontasiatSerial.Normalize(m.Serial);
            if (s.Length > 0) used.Add(s);
        }

        var renumber = new List<(long id, string from, string to)>();
        var nullify  = new List<long>();
        var seen     = new HashSet<string>(StringComparer.Ordinal);

        foreach (var m in all)
        {
            var s = MontasiatSerial.Normalize(m.Serial);
            if (s.Length == 0)
            {
                if (m.Serial != null) nullify.Add(m.Id); // "" / whitespace → NULL
                continue;
            }
            if (seen.Add(s)) continue;                   // first (oldest) occurrence keeps it

            var yy = MontasiatSerial.YearPrefix(m.Iso);
            if (!yy.All(char.IsDigit)) yy = s.Substring(0, 2);
            var ns = MontasiatSerial.Next(used, yy);     // free vs everything used so far
            used.Add(ns);
            renumber.Add((m.Id, s, ns));
        }

        if (!apply)
        {
            sw.Stop();
            return Ok(new
            {
                ok = true,
                applied = false,
                duplicatesFound = renumber.Count,
                emptySerials = nullify.Count,
                plan = renumber.Select(r => new { id = r.id, from = r.from, to = r.to }).ToArray(),
                durationMs = sw.ElapsedMilliseconds,
                note = "Dry run. Re-call with ?apply=true to renumber the newer duplicates and build the unique index."
            });
        }

        foreach (var r in renumber)
        {
            var e = await _db.Montasiat.FindAsync(r.id);
            if (e != null) { e.Serial = r.to; e.Version++; }
        }
        foreach (var id in nullify)
        {
            var e = await _db.Montasiat.FindAsync(id);
            if (e != null) { e.Serial = null; e.Version++; }
        }
        await _db.SaveChangesAsync();

        string indexNote;
        try { await _EnsureUniqueSerialIndexAsync(); indexNote = "ux_montasiat_serial ensured"; }
        catch (Exception ex) { indexNote = "index creation failed: " + ex.Message; }

        sw.Stop();
        _ = SseController.Broadcast("reload", "1");
        var userEmpId = User.FindFirst("empId")?.Value ?? "?";
        Console.WriteLine($"[DEDUPE-SERIAL] by={userEmpId} renumbered={renumber.Count} nulled={nullify.Count} in {sw.ElapsedMilliseconds}ms");

        return Ok(new
        {
            ok = true,
            applied = true,
            renumbered = renumber.Count,
            emptyNulled = nullify.Count,
            changes = renumber.Select(r => new { id = r.id, from = r.from, to = r.to }).ToArray(),
            indexNote,
            durationMs = sw.ElapsedMilliseconds,
            note = "Reload the app (Ctrl+Shift+R). The oldest record kept its number; newer duplicates were renumbered."
        });
    }

    private async Task _EnsureUniqueSerialIndexAsync()
    {
        var idxCount = (await _db.Database
            .SqlQueryRaw<long>(
                "SELECT COUNT(*) AS Value FROM information_schema.statistics " +
                "WHERE table_schema = DATABASE() AND table_name = 'montasiat' " +
                "AND index_name = 'ux_montasiat_serial'")
            .ToListAsync()).FirstOrDefault();
        if (idxCount > 0) return;
        await _db.Database.ExecuteSqlRawAsync(
            "CREATE UNIQUE INDEX ux_montasiat_serial ON montasiat (serial)");
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private bool _IsAuthorized()
    {
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        var role    = User.FindFirst("role")?.Value ?? "";
        return isAdmin || role == "cc_manager";
    }

    private static (HashSet<long> inquiries, HashSet<long> montasiat) _CollectBlobIds(string json)
    {
        var inq = new HashSet<long>();
        var mnt = new HashSet<long>();
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return (inq, mnt);

            _CollectArrayIds(root, "inquiries",  inq);
            _CollectArrayIds(root, "montasiat",  mnt);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[VERIFY] JSON parse failed: {ex.Message}");
        }
        return (inq, mnt);
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
