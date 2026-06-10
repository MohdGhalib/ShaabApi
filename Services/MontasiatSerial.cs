namespace ShaabApi.Services;

/// <summary>
/// Server-authoritative montasia reference-number (serial) generation.
/// Serial format = YY + sequence (e.g. 26 + 1963 → "261963"), per migration #11.
///
/// History (2026-06-10): two devices holding the same stale per-year counter in the
/// synced Master_DB blob could each mint the same serial (e.g. 261963) before syncing,
/// and nothing rejected the collision. The fix moves serial assignment to the server
/// (POST /api/montasiat) backed by a UNIQUE index on montasiat.serial. This class holds
/// the pure computation so it is unit-testable without a DB.
/// </summary>
public static class MontasiatSerial
{
    /// <summary>Strip separators/whitespace from a raw serial.</summary>
    public static string Normalize(string? s)
        => (s ?? "").Replace("-", "").Replace(" ", "").Trim();

    /// <summary>A well-formed serial is all-digits and at least YY + 3 = 5 chars.</summary>
    public static bool IsWellFormed(string norm)
        => norm.Length >= 5 && norm.All(char.IsDigit);

    /// <summary>2-digit year prefix taken from an ISO date (yyyy-MM-dd); falls back to "now".</summary>
    public static string YearPrefix(string? iso)
        => (!string.IsNullOrEmpty(iso) && iso!.Length >= 4 && char.IsDigit(iso[0]))
            ? iso.Substring(2, 2)
            : DateTime.UtcNow.ToString("yy");

    /// <summary>
    /// Next free serial for year <paramref name="yy"/> given the serials already in use.
    /// Takes the max sequence among existing YY-prefixed serials, then increments past any
    /// value already present in <paramref name="existing"/> (so it never returns a collision,
    /// even when called repeatedly while building up a set of newly-assigned serials).
    /// </summary>
    public static string Next(IEnumerable<string?> existing, string yy)
    {
        var used = new HashSet<string>(StringComparer.Ordinal);
        long max = 0;
        foreach (var raw in existing)
        {
            var s = Normalize(raw);
            if (s.Length == 0) continue;
            used.Add(s);
            if (s.StartsWith(yy, StringComparison.Ordinal) && s.Length > 2
                && long.TryParse(s.Substring(2), out var n) && n > max)
                max = n;
        }

        long next = max;
        string cand;
        do { next++; cand = yy + next.ToString().PadLeft(3, '0'); }
        while (used.Contains(cand));
        return cand;
    }
}
