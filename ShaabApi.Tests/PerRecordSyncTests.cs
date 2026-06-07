using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;
using ShaabApi.Services;
using Xunit;

namespace ShaabApi.Tests;

/// <summary>
/// Protects the 2026-06-07 delivery-revert guard in PerRecordSyncService:
/// a (possibly stale) full Master_DB blob must NEVER revert a montasia that is
/// already "تم التسليم", but must still allow new inserts and forward progress.
/// </summary>
public class PerRecordSyncTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;

    public PerRecordSyncTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        _options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;
        using var ctx = new AppDbContext(_options);
        ctx.Database.EnsureCreated();
    }

    public void Dispose() => _conn.Dispose();

    private AppDbContext NewCtx() => new AppDbContext(_options);

    [Fact]
    public async Task BlobRevert_KeepsDeliveredMontasia()
    {
        using (var ctx = NewCtx())
        {
            ctx.Montasiat.Add(new Montasia { Id = 5, Status = "تم التسليم", Branch = "خلدا الراية", Version = 1 });
            await ctx.SaveChangesAsync();
        }

        // stale blob tries to revert delivered → pending
        const string blob = "{\"montasiat\":[{\"id\":5,\"status\":\"قيد الانتظار\",\"branch\":\"خلدا الراية\"}]}";
        using (var ctx = NewCtx())
            await new PerRecordSyncService(ctx).SyncMasterDbAsync(blob);

        using (var ctx = NewCtx())
        {
            var m = await ctx.Montasiat.FindAsync(5L);
            Assert.NotNull(m);
            Assert.Equal("تم التسليم", m!.Status); // guard kept delivered
        }
    }

    [Fact]
    public async Task BlobInsert_NewMontasia_IsAdded()
    {
        const string blob = "{\"montasiat\":[{\"id\":9,\"status\":\"قيد الانتظار\",\"branch\":\"عمان\"}]}";
        using (var ctx = NewCtx())
            await new PerRecordSyncService(ctx).SyncMasterDbAsync(blob);

        using (var ctx = NewCtx())
        {
            var m = await ctx.Montasiat.FindAsync(9L);
            Assert.NotNull(m);
            Assert.Equal("قيد الانتظار", m!.Status); // new record inserted as-is
        }
    }

    [Fact]
    public async Task BlobForwardProgress_PendingToDelivered_IsApplied()
    {
        using (var ctx = NewCtx())
        {
            ctx.Montasiat.Add(new Montasia { Id = 7, Status = "قيد الانتظار", Branch = "عمان", Version = 1 });
            await ctx.SaveChangesAsync();
        }

        const string blob = "{\"montasiat\":[{\"id\":7,\"status\":\"تم التسليم\",\"branch\":\"عمان\"}]}";
        using (var ctx = NewCtx())
            await new PerRecordSyncService(ctx).SyncMasterDbAsync(blob);

        using (var ctx = NewCtx())
        {
            var m = await ctx.Montasiat.FindAsync(7L);
            Assert.Equal("تم التسليم", m!.Status); // legitimate progress applied
        }
    }

    [Fact]
    public async Task BlobRevert_PreservesDeliveredRecordExtras()
    {
        using (var ctx = NewCtx())
        {
            ctx.Montasiat.Add(new Montasia
            {
                Id = 11, Status = "تم التسليم", Branch = "عمان",
                Data = "{\"deliveredBy\":\"أحمد\"}", Version = 1
            });
            await ctx.SaveChangesAsync();
        }

        // stale blob reverts status and omits deliveredBy → guard must skip the whole record
        const string blob = "{\"montasiat\":[{\"id\":11,\"status\":\"قيد الانتظار\",\"branch\":\"عمان\"}]}";
        using (var ctx = NewCtx())
            await new PerRecordSyncService(ctx).SyncMasterDbAsync(blob);

        using (var ctx = NewCtx())
        {
            var m = await ctx.Montasiat.FindAsync(11L);
            Assert.Equal("تم التسليم", m!.Status);
            Assert.Contains("deliveredBy", m.Data ?? ""); // delivered record fully preserved
        }
    }
}
