using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Services;

/// <summary>
/// Mirrors the Shaab_Employees_DB JSON blob (array of employees) into the per-record
/// `employees` table. The blob stays the source of truth (auth reads it); this keeps a
/// queryable shadow for GET /api/employees. Best-effort: failures are logged, not thrown.
/// </summary>
public class EmployeeSyncService
{
    private readonly AppDbContext _db;
    public EmployeeSyncService(AppDbContext db) { _db = db; }

    private static readonly HashSet<string> _typedFields = new(StringComparer.Ordinal)
    {
        "empId", "name", "title", "salt", "passwordHash"
    };

    /// <summary>Upsert every employee from the blob array. Returns #rows upserted.</summary>
    public async Task<int> SyncFromBlobAsync(string? employeesJson)
    {
        if (string.IsNullOrWhiteSpace(employeesJson)) return 0;
        int count = 0;
        try
        {
            using var doc = JsonDocument.Parse(employeesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return 0;

            var ids = new List<string>();
            foreach (var rec in doc.RootElement.EnumerateArray())
            {
                var empId = _GetStr(rec, "empId");
                if (!string.IsNullOrEmpty(empId)) ids.Add(empId!);
            }
            if (ids.Count == 0) return 0;

            var existing = await _db.Employees
                .Where(e => ids.Contains(e.EmpId))
                .ToDictionaryAsync(e => e.EmpId);

            foreach (var rec in doc.RootElement.EnumerateArray())
            {
                var empId = _GetStr(rec, "empId");
                if (string.IsNullOrEmpty(empId)) continue;
                try
                {
                    var e = existing.TryGetValue(empId!, out var found) ? found : null;
                    if (e == null)
                    {
                        e = new Employee { EmpId = empId!, CreatedAt = DateTime.UtcNow };
                        _db.Employees.Add(e);
                        existing[empId!] = e;
                    }
                    e.Name         = _GetStr(rec, "name");
                    e.Title        = _GetStr(rec, "title");
                    e.Salt         = _GetStr(rec, "salt");
                    e.PasswordHash = _GetStr(rec, "passwordHash");
                    e.Data         = _ExtractExtras(rec);
                    count++;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[EMP-SYNC] emp {empId} skip: {ex.Message}");
                }
            }

            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[EMP-SYNC] failed: {ex.GetType().Name}: {ex.Message}");
        }
        return count;
    }

    private static string? _GetStr(JsonElement rec, string prop)
    {
        if (rec.ValueKind != JsonValueKind.Object || !rec.TryGetProperty(prop, out var el)) return null;
        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.GetRawText(),
            _ => null
        };
    }

    private static string? _ExtractExtras(JsonElement rec)
    {
        if (rec.ValueKind != JsonValueKind.Object) return null;
        Dictionary<string, JsonElement>? extras = null;
        foreach (var p in rec.EnumerateObject())
        {
            if (_typedFields.Contains(p.Name)) continue;
            extras ??= new Dictionary<string, JsonElement>();
            extras[p.Name] = p.Value;
        }
        return extras == null ? null : JsonSerializer.Serialize(extras);
    }
}
