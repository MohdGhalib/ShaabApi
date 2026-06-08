using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Controllers;
using ShaabApi.Data;
using ShaabApi.Models;
using Xunit;

namespace ShaabApi.Tests;

/// <summary>
/// Protects the delivery-revert guard on the per-record PUT endpoint: a stale client
/// (mobile / conflict-merge) must NOT be able to roll a "تم التسليم" montasia back to an
/// earlier status, while cc_manager/admin may still legitimately un-deliver.
/// </summary>
public class MontasiatGuardTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;

    public MontasiatGuardTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        _options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;
        using var ctx = new AppDbContext(_options);
        ctx.Database.EnsureCreated();
    }

    public void Dispose() => _conn.Dispose();

    private AppDbContext NewCtx() => new AppDbContext(_options);
    private static JsonElement Json(string s) => JsonDocument.Parse(s).RootElement;

    private static MontasiatController WithRole(AppDbContext ctx, string role, bool isAdmin = false)
    {
        var claims = new List<Claim> { new("role", role), new("isAdmin", isAdmin ? "true" : "false") };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        return new MontasiatController(ctx)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } }
        };
    }

    private async Task SeedDelivered(long id)
    {
        using var ctx = NewCtx();
        ctx.Montasiat.Add(new Montasia { Id = id, Status = "تم التسليم", Branch = "الرئيسي", Version = 5 });
        await ctx.SaveChangesAsync();
    }

    [Fact]
    public async Task Update_NonManager_CannotRevertDelivered()
    {
        await SeedDelivered(100);
        using (var ctx = NewCtx())
        {
            var c = WithRole(ctx, "media");
            var res = await c.Update(100, Json("{\"id\":100,\"status\":\"قيد الانتظار\",\"deliveredBy\":\"\"}"));
            Assert.IsType<OkObjectResult>(res); // returns Ok (no-op) so the stale client reconciles
        }
        using (var ctx = NewCtx())
            Assert.Equal("تم التسليم", (await ctx.Montasiat.FindAsync(100L))!.Status); // unchanged
    }

    [Fact]
    public async Task Update_ControlSub_CannotRevertDelivered()
    {
        await SeedDelivered(101);
        using (var ctx = NewCtx())
            await WithRole(ctx, "control_sub").Update(101, Json("{\"id\":101,\"status\":\"قيد الاستلام\"}"));
        using (var ctx = NewCtx())
            Assert.Equal("تم التسليم", (await ctx.Montasiat.FindAsync(101L))!.Status);
    }

    [Fact]
    public async Task Update_CcManager_CanLegitimatelyUndeliver()
    {
        await SeedDelivered(102);
        using (var ctx = NewCtx())
        {
            var res = await WithRole(ctx, "cc_manager").Update(102, Json("{\"id\":102,\"status\":\"قيد الانتظار\"}"));
            Assert.IsType<OkObjectResult>(res);
        }
        using (var ctx = NewCtx())
            Assert.Equal("قيد الانتظار", (await ctx.Montasiat.FindAsync(102L))!.Status); // allowed
    }

    [Fact]
    public async Task Update_Admin_CanLegitimatelyUndeliver()
    {
        await SeedDelivered(103);
        using (var ctx = NewCtx())
            await WithRole(ctx, "", isAdmin: true).Update(103, Json("{\"id\":103,\"status\":\"قيد الانتظار\"}"));
        using (var ctx = NewCtx())
            Assert.Equal("قيد الانتظار", (await ctx.Montasiat.FindAsync(103L))!.Status);
    }

    [Fact]
    public async Task Update_NonManager_CanStillProgressToDelivered()
    {
        // الحارس يمنع التراجع فقط — التقدّم إلى "تم التسليم" مسموح للجميع
        using (var ctx = NewCtx())
        {
            ctx.Montasiat.Add(new Montasia { Id = 104, Status = "قيد الانتظار", Branch = "الرئيسي", Version = 2 });
            await ctx.SaveChangesAsync();
        }
        using (var ctx = NewCtx())
            await WithRole(ctx, "media").Update(104, Json("{\"id\":104,\"status\":\"تم التسليم\",\"deliveredBy\":\"x\"}"));
        using (var ctx = NewCtx())
            Assert.Equal("تم التسليم", (await ctx.Montasiat.FindAsync(104L))!.Status);
    }
}
