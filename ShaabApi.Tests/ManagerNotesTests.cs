using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Controllers;
using ShaabApi.Data;
using Xunit;

namespace ShaabApi.Tests;

/// <summary>
/// Covers the regional-managers notes feature (ملاحظات مدراء مناطق): POST appends (idempotent),
/// GET returns newest-first, PATCH closes with a closing note, and PATCH soft-deletes.
/// </summary>
public class ManagerNotesTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;

    public ManagerNotesTests()
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

    [Fact]
    public async Task Post_AddsNote_AndIsIdempotent()
    {
        using (var ctx = NewCtx())
        {
            var ctrl = new ManagerNotesController(ctx);
            await ctrl.Add(Body("{\"id\":100,\"branch\":\"خلدا\",\"noteDate\":\"2026-06-11\",\"notifiedPerson\":\"أحمد\",\"text\":\"تأخر فتح الفرع\",\"ts\":1700000000000}"));
            await ctrl.Add(Body("{\"id\":100,\"branch\":\"خلدا\",\"text\":\"DUPLICATE\",\"ts\":1700000000000}")); // same id ignored
        }
        using (var ctx = NewCtx())
        {
            Assert.Equal(1, await ctx.ManagerNotes.CountAsync());
            var n = await ctx.ManagerNotes.FindAsync(100L);
            Assert.Equal("تأخر فتح الفرع", n!.Text);
            Assert.False(n.Closed);
        }
    }

    [Fact]
    public async Task Patch_ClosesNote_WithClosingNote()
    {
        using (var ctx = NewCtx())
        {
            var ctrl = new ManagerNotesController(ctx);
            await ctrl.Add(Body("{\"id\":7,\"branch\":\"الراية\",\"text\":\"ملاحظة\",\"ts\":1}"));
            await ctrl.Patch(7, Body("{\"closed\":true,\"closeNote\":\"تمت المعالجة\",\"closedBy\":\"المدير\",\"closedAt\":1700000000001}"));
        }
        using (var ctx = NewCtx())
        {
            var n = await ctx.ManagerNotes.FindAsync(7L);
            Assert.True(n!.Closed);
            Assert.Equal("تمت المعالجة", n.CloseNote);
            Assert.Equal("المدير", n.ClosedBy);
        }
    }

    [Fact]
    public async Task Patch_MissingRow_UpsertsFromFullBody()
    {
        // simulates a lost POST: close arrives for a note the server never stored
        using (var ctx = NewCtx())
        {
            var ctrl = new ManagerNotesController(ctx);
            await ctrl.Patch(555, Body("{\"id\":555,\"branch\":\"الراية\",\"noteDate\":\"2026-06-11\",\"text\":\"ملاحظة\",\"ts\":5,\"closed\":true,\"closeNote\":\"تم\",\"closedBy\":\"المدير\"}"));
        }
        using (var ctx = NewCtx())
        {
            var n = await ctx.ManagerNotes.FindAsync(555L);
            Assert.NotNull(n);
            Assert.True(n!.Closed);
            Assert.Equal("تم", n.CloseNote);
            Assert.Equal("ملاحظة", n.Text);
        }
    }

    [Fact]
    public async Task Patch_SoftDeletes()
    {
        using (var ctx = NewCtx())
        {
            var ctrl = new ManagerNotesController(ctx);
            await ctrl.Add(Body("{\"id\":9,\"branch\":\"X\",\"text\":\"t\",\"ts\":1}"));
            await ctrl.Patch(9, Body("{\"deleted\":true}"));
        }
        using (var ctx = NewCtx())
        {
            var n = await ctx.ManagerNotes.FindAsync(9L);
            Assert.True(n!.Deleted);
        }
    }

    [Fact]
    public async Task Get_ReturnsNewestFirst()
    {
        using (var ctx = NewCtx())
        {
            var ctrl = new ManagerNotesController(ctx);
            await ctrl.Add(Body("{\"id\":1,\"branch\":\"A\",\"text\":\"old\",\"ts\":1000}"));
            await ctrl.Add(Body("{\"id\":2,\"branch\":\"B\",\"text\":\"new\",\"ts\":2000}"));
        }
        using (var ctx = NewCtx())
        {
            var ctrl = new ManagerNotesController(ctx);
            var res = await ctrl.GetRange(null, null) as Microsoft.AspNetCore.Mvc.OkObjectResult;
            Assert.NotNull(res);
            var list = Assert.IsAssignableFrom<System.Collections.IEnumerable>(res!.Value);
            var ids = new List<long>();
            foreach (var item in list)
            {
                var obj = (System.Text.Json.Nodes.JsonObject)item!;
                ids.Add(obj["id"]!.GetValue<long>());
            }
            Assert.Equal(new long[] { 2, 1 }, ids.ToArray());
        }
    }
}
