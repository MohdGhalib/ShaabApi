using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Services;

/// <summary>
/// Phase 2 of migration #11 — Dual-write service.
/// Mirrors inquiries/montasiat/complaints from Master_DB JSON blob into per-record tables
/// after each Master_DB save. Best-effort: failures are logged but never bubble up.
/// JSON blob remains source of truth until Phase 4 cutover.
/// </summary>
public class PerRecordSyncService
{
    private readonly AppDbContext _db;

    private static readonly HashSet<string> _inquiryTypedFields = new(StringComparer.Ordinal)
    {
        "id", "seq", "city", "branch", "phone", "type", "notes",
        "itemName", "offerName", "qualityPhoto", "time", "iso", "addedBy"
    };

    private static readonly HashSet<string> _montasiaTypedFields = new(StringComparer.Ordinal)
    {
        "id", "serial", "branch", "type", "status", "time", "iso", "addedBy"
    };

    private static readonly HashSet<string> _complaintTypedFields = new(StringComparer.Ordinal)
    {
        "id", "branch", "notes", "time", "iso", "file", "addedBy"
    };

    public PerRecordSyncService(AppDbContext db) { _db = db; }

    public async Task<(int inquiries, int montasiat, int complaints)> SyncMasterDbAsync(string masterDbJson)
    {
        int inqCount = 0, mntCount = 0, cmpCount = 0;
        try
        {
            using var doc = JsonDocument.Parse(masterDbJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return (0, 0, 0);

            if (root.TryGetProperty("inquiries",  out var inqArr) && inqArr.ValueKind == JsonValueKind.Array)
                inqCount = UpsertInquiries(inqArr);

            if (root.TryGetProperty("montasiat",  out var mntArr) && mntArr.ValueKind == JsonValueKind.Array)
                mntCount = await UpsertMontasiatAsync(mntArr);

            if (root.TryGetProperty("complaints", out var cmpArr) && cmpArr.ValueKind == JsonValueKind.Array)
                cmpCount = await UpsertComplaintsAsync(cmpArr);

            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DUAL-WRITE] sync failed: {ex.GetType().Name}: {ex.Message}");
        }
        return (inqCount, mntCount, cmpCount);
    }

    private int UpsertInquiries(JsonElement arr)
    {
        var ids = CollectIds(arr);
        var existing = _db.Inquiries.Where(i => ids.Contains(i.Id)).ToDictionary(i => i.Id);

        int count = 0;
        foreach (var rec in arr.EnumerateArray())
        {
            if (!TryGetLongId(rec, out var id)) continue;
            try
            {
                var e = existing.TryGetValue(id, out var found) ? found : null;
                if (e == null)
                {
                    e = new Inquiry { Id = id };
                    _db.Inquiries.Add(e);
                }
                e.Seq          = GetIntOrNull(rec, "seq");
                e.City         = GetStringOrNull(rec, "city", 100);
                e.Branch       = GetStringOrNull(rec, "branch", 100);
                e.Phone        = GetStringOrNull(rec, "phone", 30);
                e.Type         = GetStringOrNull(rec, "type", 50);
                e.Notes        = GetStringOrNull(rec, "notes", int.MaxValue);
                e.ItemName     = GetStringOrNull(rec, "itemName", 200);
                e.OfferName    = GetStringOrNull(rec, "offerName", 200);
                e.QualityPhoto = GetStringOrNull(rec, "qualityPhoto", int.MaxValue);
                e.Time         = GetStringOrNull(rec, "time", 50);
                e.Iso          = GetStringOrNull(rec, "iso", 50);
                e.AddedBy      = GetStringOrNull(rec, "addedBy", 100);
                e.Data         = ExtractExtraFields(rec, _inquiryTypedFields);
                count++;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DUAL-WRITE] inquiry id={id} skip: {ex.Message}");
            }
        }
        return count;
    }

    private async Task<int> UpsertMontasiatAsync(JsonElement arr)
    {
        var ids = CollectIds(arr);
        var existing = await _db.Montasiat.Where(m => ids.Contains(m.Id)).ToDictionaryAsync(m => m.Id);

        int count = 0;
        foreach (var rec in arr.EnumerateArray())
        {
            if (!TryGetLongId(rec, out var id)) continue;
            try
            {
                var e = existing.TryGetValue(id, out var found) ? found : null;
                if (e == null)
                {
                    e = new Montasia { Id = id };
                    _db.Montasiat.Add(e);
                }
                e.Serial   = GetIntOrNull(rec, "serial");
                e.Branch   = GetStringOrNull(rec, "branch", 100);
                e.Type     = GetStringOrNull(rec, "type", 50);
                e.Status   = GetStringOrNull(rec, "status", 50);
                e.Time     = GetStringOrNull(rec, "time", 50);
                e.Iso      = GetStringOrNull(rec, "iso", 50);
                e.AddedBy  = GetStringOrNull(rec, "addedBy", 100);
                e.Data     = ExtractExtraFields(rec, _montasiaTypedFields);
                count++;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DUAL-WRITE] montasia id={id} skip: {ex.Message}");
            }
        }
        return count;
    }

    private async Task<int> UpsertComplaintsAsync(JsonElement arr)
    {
        var ids = CollectIds(arr);
        var existing = await _db.Complaints.Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id);

        int count = 0;
        foreach (var rec in arr.EnumerateArray())
        {
            if (!TryGetLongId(rec, out var id)) continue;
            try
            {
                var e = existing.TryGetValue(id, out var found) ? found : null;
                if (e == null)
                {
                    e = new Complaint { Id = id };
                    _db.Complaints.Add(e);
                }
                e.Branch  = GetStringOrNull(rec, "branch", 100);
                e.Notes   = GetStringOrNull(rec, "notes", int.MaxValue);
                e.Time    = GetStringOrNull(rec, "time", 50);
                e.Iso     = GetStringOrNull(rec, "iso", 50);
                e.File    = GetStringOrNull(rec, "file", int.MaxValue);
                e.AddedBy = GetStringOrNull(rec, "addedBy", 100);
                e.Data    = ExtractExtraFields(rec, _complaintTypedFields);
                count++;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DUAL-WRITE] complaint id={id} skip: {ex.Message}");
            }
        }
        return count;
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private static HashSet<long> CollectIds(JsonElement arr)
    {
        var ids = new HashSet<long>();
        foreach (var rec in arr.EnumerateArray())
            if (TryGetLongId(rec, out var id)) ids.Add(id);
        return ids;
    }

    private static bool TryGetLongId(JsonElement rec, out long id)
    {
        id = 0;
        if (rec.ValueKind != JsonValueKind.Object) return false;
        if (!rec.TryGetProperty("id", out var idEl)) return false;
        return idEl.ValueKind switch
        {
            JsonValueKind.Number => idEl.TryGetInt64(out id),
            JsonValueKind.String => long.TryParse(idEl.GetString(), out id),
            _ => false
        };
    }

    private static string? GetStringOrNull(JsonElement rec, string prop, int maxLen)
    {
        if (!rec.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Null) return null;
        string? s = el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.GetRawText(),
            JsonValueKind.True   => "true",
            JsonValueKind.False  => "false",
            _ => null
        };
        if (s == null) return null;
        return (maxLen < int.MaxValue && s.Length > maxLen) ? s.Substring(0, maxLen) : s;
    }

    private static int? GetIntOrNull(JsonElement rec, string prop)
    {
        if (!rec.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n)) return n;
        if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), out var ns)) return ns;
        return null;
    }

    private static string? ExtractExtraFields(JsonElement rec, HashSet<string> typedFields)
    {
        if (rec.ValueKind != JsonValueKind.Object) return null;
        Dictionary<string, JsonElement>? extras = null;
        foreach (var p in rec.EnumerateObject())
        {
            if (typedFields.Contains(p.Name)) continue;
            extras ??= new Dictionary<string, JsonElement>();
            extras[p.Name] = p.Value;
        }
        if (extras == null) return null;
        return JsonSerializer.Serialize(extras);
    }
}
