using System.Text.Json;

namespace ShaabApi.Services;

/// <summary>
/// Phase 5a — shared helpers for mapping incoming JSON bodies onto per-record
/// entities (Inquiry/Montasia/Complaint). Mirrors the field-extraction logic
/// that PerRecordSyncService uses for dual-write, but exposed publicly so the
/// new POST/PUT/DELETE controllers can reuse it.
/// </summary>
public static class RecordMapper
{
    public static bool TryGetLongId(JsonElement rec, out long id)
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

    public static string? GetStringOrNull(JsonElement rec, string prop, int maxLen)
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

    public static int? GetIntOrNull(JsonElement rec, string prop)
    {
        if (!rec.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n)) return n;
        if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), out var ns)) return ns;
        return null;
    }

    public static string? ExtractExtraFields(JsonElement rec, HashSet<string> typedFields)
    {
        if (rec.ValueKind != JsonValueKind.Object) return null;
        Dictionary<string, JsonElement>? extras = null;
        foreach (var p in rec.EnumerateObject())
        {
            if (typedFields.Contains(p.Name)) continue;
            extras ??= new Dictionary<string, JsonElement>();
            extras[p.Name] = p.Value.Clone();
        }
        if (extras == null) return null;
        return JsonSerializer.Serialize(extras);
    }

    /// <summary>
    /// Merge { "deleted": true } into an existing `data` JSON object. Used for
    /// soft-delete via DELETE endpoints. Preserves all other extra fields.
    /// </summary>
    public static string MergeDeletedFlag(string? existingData)
    {
        var extras = new Dictionary<string, JsonElement>();
        if (!string.IsNullOrEmpty(existingData))
        {
            try
            {
                using var doc = JsonDocument.Parse(existingData);
                if (doc.RootElement.ValueKind == JsonValueKind.Object)
                {
                    foreach (var p in doc.RootElement.EnumerateObject())
                        extras[p.Name] = p.Value.Clone();
                }
            }
            catch { /* malformed JSON → start fresh */ }
        }
        using var trueDoc = JsonDocument.Parse("true");
        extras["deleted"] = trueDoc.RootElement.Clone();
        return JsonSerializer.Serialize(extras);
    }
}
