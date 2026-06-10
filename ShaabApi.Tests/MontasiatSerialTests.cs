using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Controllers;
using ShaabApi.Data;
using ShaabApi.Models;
using ShaabApi.Services;
using Xunit;

namespace ShaabApi.Tests;

/// <summary>
/// Protects the 2026-06-10 duplicate-serial fix: serials (reference numbers like 261963)
/// must be unique. Covers the pure generator (MontasiatSerial) and the server-authoritative
/// assignment in MontasiatController.Create backed by the ux_montasiat_serial unique index.
/// </summary>
public class MontasiatSerialTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;

    public MontasiatSerialTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        _options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;
        using var ctx = new AppDbContext(_options);
        ctx.Database.EnsureCreated();
    }

    public void Dispose() => _conn.Dispose();

    private AppDbContext NewCtx() => new(_options);
    private static JsonElement Body(string json) => JsonDocument.Parse(json).RootElement.Clone();

    // ── pure generator ───────────────────────────────────────────────────

    [Fact]
    public void Next_EmptyExisting_StartsAt001()
        => Assert.Equal("26001", MontasiatSerial.Next(Array.Empty<string?>(), "26"));

    [Fact]
    public void Next_IncrementsPastMax()
        => Assert.Equal("261964", MontasiatSerial.Next(new[] { "261963", "261000" }, "26"));

    [Fact]
    public void Next_AvoidsCollisionWithinProvidedSet()
        => Assert.Equal("261965", MontasiatSerial.Next(new[] { "261963", "261964" }, "26"));

    [Fact]
    public void Next_IgnoresOtherYears()
        => Assert.Equal("26001", MontasiatSerial.Next(new[] { "25999" }, "26"));

    [Fact]
    public void YearPrefix_ComesFromIso()
        => Assert.Equal("26", MontasiatSerial.YearPrefix("2026-05-01"));

    [Fact]
    public void Normalize_StripsDashesAndSpaces()
        => Assert.Equal("261963", MontasiatSerial.Normalize("26-19 63"));

    // ── unique index (DB level) ──────────────────────────────────────────

    [Fact]
    public async Task UniqueIndex_RejectsDuplicateSerial()
    {
        using var ctx = NewCtx();
        ctx.Montasiat.Add(new Montasia { Id = 1, Serial = "261963", Version = 1 });
        ctx.Montasiat.Add(new Montasia { Id = 2, Serial = "261963", Version = 1 });
        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [Fact]
    public async Task UniqueIndex_AllowsMultipleNullSerials()
    {
        using var ctx = NewCtx();
        ctx.Montasiat.Add(new Montasia { Id = 1, Serial = null, Version = 1 });
        ctx.Montasiat.Add(new Montasia { Id = 2, Serial = null, Version = 1 });
        await ctx.SaveChangesAsync(); // NULLs are distinct — no throw
        Assert.Equal(2, await ctx.Montasiat.CountAsync());
    }

    // ── server-authoritative Create ──────────────────────────────────────

    [Fact]
    public async Task Create_DuplicateSerial_GetsReassigned()
    {
        using (var ctx = NewCtx())
        {
            ctx.Montasiat.Add(new Montasia { Id = 1, Serial = "261963", Iso = "2026-05-01", Version = 1 });
            await ctx.SaveChangesAsync();
        }

        using (var ctx = NewCtx())
        {
            var ctrl = new MontasiatController(ctx);
            await ctrl.Create(Body("{\"id\":2,\"serial\":\"261963\",\"iso\":\"2026-05-02\"}"));
        }

        using (var ctx = NewCtx())
        {
            var m2 = await ctx.Montasiat.FindAsync(2L);
            Assert.NotNull(m2);
            Assert.NotEqual("261963", m2!.Serial);                 // not the duplicate
            Assert.Equal(2, await ctx.Montasiat.Select(m => m.Serial).Distinct().CountAsync());
        }
    }

    [Fact]
    public async Task Create_UniqueClientSerial_IsHonored()
    {
        using (var ctx = NewCtx())
        {
            var ctrl = new MontasiatController(ctx);
            await ctrl.Create(Body("{\"id\":7,\"serial\":\"267777\",\"iso\":\"2026-05-02\"}"));
        }
        using (var ctx = NewCtx())
        {
            var m = await ctx.Montasiat.FindAsync(7L);
            Assert.Equal("267777", m!.Serial); // unused, well-formed → kept as-is
        }
    }

    [Fact]
    public async Task Create_MissingSerial_MintsOne()
    {
        using (var ctx = NewCtx())
        {
            ctx.Montasiat.Add(new Montasia { Id = 1, Serial = "26005", Iso = "2026-01-01", Version = 1 });
            await ctx.SaveChangesAsync();
        }
        using (var ctx = NewCtx())
        {
            var ctrl = new MontasiatController(ctx);
            await ctrl.Create(Body("{\"id\":2,\"iso\":\"2026-05-02\"}")); // no serial
        }
        using (var ctx = NewCtx())
        {
            var m = await ctx.Montasiat.FindAsync(2L);
            Assert.Equal("26006", m!.Serial); // next after 26005
        }
    }
}
