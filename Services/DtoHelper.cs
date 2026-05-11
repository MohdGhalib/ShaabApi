using System.Text.Json;

namespace ShaabApi.Controllers;

/// <summary>
/// Helper for Phase 4a controllers — merges the `data` JSON column's extra
/// fields into the response dictionary alongside the typed columns.
/// Typed-column keys always win; extras only fill in fields the entity
/// doesn't already define.
/// </summary>
internal static class DtoHelper
{
    public static void MergeDataExtras(string? dataJson, Dictionary<string, object?> target)
    {
        if (string.IsNullOrEmpty(dataJson)) return;
        try
        {
            using var doc = JsonDocument.Parse(dataJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return;
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (target.ContainsKey(prop.Name)) continue;
                target[prop.Name] = prop.Value.Clone();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DTO] data parse failed: {ex.Message}");
        }
    }
}
