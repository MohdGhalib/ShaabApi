using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Controllers;
using ShaabApi.Data;
using Xunit;

namespace ShaabApi.Tests;

/// <summary>
/// Protects the audit_log append endpoint: appending the same id twice must be
/// idempotent (no duplicate-key crash, one row) and range queries must work.
/// </summary>
public class AuditControllerTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;

    public AuditControllerTests()
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

    [Fact]
    public async Task Add_SameId_Twice_IsIdempotent_OneRow()
    {
        using (var ctx = NewCtx())
        {
            var r1 = await new AuditController(ctx).Add(
                Json("{\"id\":\"a_1\",\"action\":\"login\",\"summary\":\"s\",\"empId\":\"0799\",\"ts\":1000}"));
            Assert.IsType<OkObjectResult>(r1);
        }
        using (var ctx = NewCtx())
        {
            // same id again (e.g. two tabs) — must not crash, must not duplicate
            var r2 = await new AuditController(ctx).Add(
                Json("{\"id\":\"a_1\",\"action\":\"login\",\"summary\":\"s2\",\"empId\":\"0799\",\"ts\":2000}"));
            Assert.IsType<OkObjectResult>(r2);
        }
        using (var ctx = NewCtx())
            Assert.Equal(1, await ctx.AuditLog.CountAsync());
    }

    [Fact]
    public async Task GetRange_ReturnsEntriesWithinWindow_NewestFirst()
    {
        var nowMs = 1_700_000_000_000L;
        using (var ctx = NewCtx())
        {
            var c = new AuditController(ctx);
            await c.Add(Json($"{{\"id\":\"old\",\"action\":\"x\",\"ts\":{nowMs - 1000}}}"));
            await c.Add(Json($"{{\"id\":\"new\",\"action\":\"y\",\"ts\":{nowMs}}}"));
        }
        using (var ctx = NewCtx())
        {
            var res = await new AuditController(ctx).GetRange(nowMs - 5000, nowMs + 5000, null);
            var ok = Assert.IsType<OkObjectResult>(res);
            var list = Assert.IsAssignableFrom<IEnumerable<Dictionary<string, object?>>>(ok.Value).ToList();
            Assert.Equal(2, list.Count);
            Assert.Equal("new", list[0]["id"]); // newest first
        }
    }
}
