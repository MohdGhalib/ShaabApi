using Microsoft.AspNetCore.Mvc;
using System.Collections.Concurrent;
using System.Text;

namespace ShaabApi.Controllers;

[ApiController]
[Route("api/sse")]
public class SseController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, SseClient> _clients = new();
    private readonly IConfiguration _config;

    public SseController(IConfiguration config)
    {
        _config = config;
    }

    // GET /api/sse?t=TOKEN
    [HttpGet]
    public async Task Connect([FromQuery] string t)
    {
        // التحقق من التوكن عبر query string
        var expectedToken = _config["SseToken"] ?? "";
        if (string.IsNullOrEmpty(t) || t != expectedToken)
        {
            Response.StatusCode = 401;
            return;
        }

        var clientId = Guid.NewGuid().ToString("N");

        Response.Headers["Content-Type"]  = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["Connection"]    = "keep-alive";
        Response.Headers["X-Accel-Buffering"] = "no";

        var cts = new CancellationTokenSource();
        var client = new SseClient(Response.Body, cts);
        _clients.TryAdd(clientId, client);

        try
        {
            // إرسال حدث اتصال أولي
            await WriteEventAsync(Response.Body, "connected", "1", cts.Token);

            // heartbeat كل 25 ثانية لمنع انقطاع الاتصال
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(25));
            while (!HttpContext.RequestAborted.IsCancellationRequested && !cts.Token.IsCancellationRequested)
            {
                try
                {
                    await timer.WaitForNextTickAsync(HttpContext.RequestAborted);
                    await WriteEventAsync(Response.Body, "heartbeat", "ping", HttpContext.RequestAborted);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
        catch (Exception)
        {
            // الاتصال انقطع — تجاهل الخطأ
        }
        finally
        {
            _clients.TryRemove(clientId, out _);
            cts.Dispose();
        }
    }

    // إرسال حدث لجميع العملاء المتصلين
    public static async Task Broadcast(string eventName, string data)
    {
        var deadClients = new List<string>();

        foreach (var (id, client) in _clients)
        {
            try
            {
                await WriteEventAsync(client.Stream, eventName, data, client.Cts.Token);
            }
            catch
            {
                deadClients.Add(id);
            }
        }

        // تنظيف العملاء المنقطعين
        foreach (var id in deadClients)
        {
            if (_clients.TryRemove(id, out var dead))
                dead.Cts.Cancel();
        }
    }

    private static async Task WriteEventAsync(Stream stream, string eventName, string data, CancellationToken ct)
    {
        var msg = $"event: {eventName}\ndata: {data}\n\n";
        var bytes = Encoding.UTF8.GetBytes(msg);
        await stream.WriteAsync(bytes, ct);
        await stream.FlushAsync(ct);
    }
}

public record SseClient(Stream Stream, CancellationTokenSource Cts);
