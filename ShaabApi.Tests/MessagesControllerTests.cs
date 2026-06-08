using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Controllers;
using ShaabApi.Data;
using Xunit;

namespace ShaabApi.Tests;

/// <summary>
/// Protects the messages endpoint (messages moved off the Master_DB blob into their own
/// table): POST is idempotent on id, PATCH flips read/delete flags, GET returns newest-first
/// within the window, and ToDto overlays the authoritative read/deleted columns onto `data`.
/// </summary>
public class MessagesControllerTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;

    public MessagesControllerTests()
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
    private static List<JsonObject> AsList(IActionResult res)
    {
        var ok = Assert.IsType<OkObjectResult>(res);
        return Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value).Cast<JsonObject>().ToList();
    }

    [Fact]
    public async Task Add_SameId_Twice_IsIdempotent_OneRow()
    {
        using (var ctx = NewCtx())
        {
            var r1 = await new MessagesController(ctx).Add(
                Json("{\"id\":1000,\"from\":\"A\",\"to\":\"B\",\"text\":\"hi\",\"ts\":1000}"));
            Assert.IsType<OkObjectResult>(r1);
        }
        using (var ctx = NewCtx())
        {
            // same id again (e.g. retry / two tabs) — must not crash, must not duplicate
            var r2 = await new MessagesController(ctx).Add(
                Json("{\"id\":1000,\"from\":\"A\",\"to\":\"B\",\"text\":\"hi again\",\"ts\":2000}"));
            Assert.IsType<OkObjectResult>(r2);
        }
        using (var ctx = NewCtx())
            Assert.Equal(1, await ctx.Messages.CountAsync());
    }

    [Fact]
    public async Task Patch_SetsReadAndDeleted_AndGetReflectsThem()
    {
        using (var ctx = NewCtx())
            await new MessagesController(ctx).Add(
                Json("{\"id\":5,\"from\":\"A\",\"to\":\"B\",\"text\":\"x\",\"ts\":1000,\"readByMe\":false}"));

        using (var ctx = NewCtx())
        {
            var r = await new MessagesController(ctx).Patch(5, Json("{\"readByMe\":true}"));
            Assert.IsType<OkObjectResult>(r);
        }
        using (var ctx = NewCtx())
        {
            var row = await ctx.Messages.FirstAsync(m => m.Id == 5);
            Assert.True(row.ReadByMe);
            Assert.False(row.Deleted);
        }
    }

    [Fact]
    public async Task GetRange_NewestFirst_OverlaysReadFlag_KeepsDataFields()
    {
        var nowMs = 1_700_000_000_000L;
        using (var ctx = NewCtx())
        {
            var c = new MessagesController(ctx);
            await c.Add(Json($"{{\"id\":1,\"from\":\"A\",\"to\":\"B\",\"text\":\"old\",\"ts\":{nowMs - 1000},\"replyToId\":99}}"));
            await c.Add(Json($"{{\"id\":2,\"from\":\"A\",\"to\":\"B\",\"text\":\"new\",\"ts\":{nowMs},\"readByMe\":false}}"));
            await c.Patch(2, Json("{\"readByMe\":true}"));
        }
        using (var ctx = NewCtx())
        {
            var list = AsList(await new MessagesController(ctx).GetRange(nowMs - 5000, null));
            Assert.Equal(2, list.Count);
            Assert.Equal(2L, list[0]["id"]!.GetValue<long>());          // newest first
            Assert.True(list[0]["readByMe"]!.GetValue<bool>());          // column overlay applied
            // a non-column field from the original object survives via `data`
            Assert.Equal(99L, list[1]["replyToId"]!.GetValue<long>());
        }
    }

    [Fact]
    public async Task GetRange_ExcludesOlderThanWindow()
    {
        var nowMs = 1_700_000_000_000L;
        using (var ctx = NewCtx())
        {
            var c = new MessagesController(ctx);
            await c.Add(Json($"{{\"id\":1,\"from\":\"A\",\"to\":\"B\",\"text\":\"ancient\",\"ts\":{nowMs - 100000}}}"));
            await c.Add(Json($"{{\"id\":2,\"from\":\"A\",\"to\":\"B\",\"text\":\"recent\",\"ts\":{nowMs}}}"));
        }
        using (var ctx = NewCtx())
        {
            var list = AsList(await new MessagesController(ctx).GetRange(nowMs - 5000, null));
            Assert.Single(list);
            Assert.Equal("recent", list[0]["text"]!.GetValue<string>());
        }
    }
}
