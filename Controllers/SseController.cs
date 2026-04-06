using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
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

    // GET /api/sse?token=JWT
    [HttpGet]
    public async Task Connect([FromQuery] string token)
    {
        // التحقق من JWT بدل التوكن المخصص
        if (!ValidateJwt(token))
        {
            Response.StatusCode = 401;
            return;
        }

        var clientId = Guid.NewGuid().ToString("N");

        Response.Headers["Content-Type"]      = "text/event-stream";
        Response.Headers["Cache-Control"]     = "no-cache";
        Response.Headers["Connection"]        = "keep-alive";
        Response.Headers["X-Accel-Buffering"] = "no";

        var cts    = new CancellationTokenSource();
        var client = new SseClient(Response.Body, cts);
        _clients.TryAdd(clientId, client);

        try
        {
            await WriteEventAsync(Response.Body, "connected", "1", cts.Token);

            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(25));
            while (!HttpContext.RequestAborted.IsCancellationRequested && !cts.Token.IsCancellationRequested)
            {
                try
                {
                    await timer.WaitForNextTickAsync(HttpContext.RequestAborted);
                    await WriteEventAsync(Response.Body, "heartbeat", "ping", HttpContext.RequestAborted);
                }
                catch (OperationCanceledException) { break; }
            }
        }
        catch { }
        finally
        {
            _clients.TryRemove(clientId, out _);
            cts.Dispose();
        }
    }

    private bool ValidateJwt(string? token)
    {
        if (string.IsNullOrEmpty(token)) return false;
        var key = _config["Jwt:Key"];
        if (string.IsNullOrEmpty(key)) return false;

        try
        {
            var handler = new JwtSecurityTokenHandler();
            handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                ValidateIssuer           = true,
                ValidIssuer              = _config["Jwt:Issuer"],
                ValidateAudience         = true,
                ValidAudience            = _config["Jwt:Issuer"],
                ValidateLifetime         = true,
                ClockSkew                = TimeSpan.Zero
            }, out _);
            return true;
        }
        catch { return false; }
    }

    // POST /api/sse/complaint-notify — يُطلق حدث تنبيه شكوى لجميع المتصلين
    [HttpPost("complaint-notify")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> ComplaintNotify([FromBody] ComplaintNotifyRequest? body)
    {
        var role    = User.FindFirst("role")?.Value    ?? "";
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        if (!isAdmin && role != "cc_employee" && role != "media")
            return Forbid();

        var payload = System.Text.Json.JsonSerializer.Serialize(new {
            id     = body?.Id     ?? "",
            branch = body?.Branch ?? "",
            city   = body?.City   ?? "",
            notes  = body?.Notes  ?? ""
        });
        await Broadcast("new-complaint", payload);
        return Ok(new { ok = true });
    }

    public static async Task Broadcast(string eventName, string data)
    {
        var deadClients = new List<string>();

        foreach (var (id, client) in _clients)
        {
            try { await WriteEventAsync(client.Stream, eventName, data, client.Cts.Token); }
            catch { deadClients.Add(id); }
        }

        foreach (var id in deadClients)
            if (_clients.TryRemove(id, out var dead)) dead.Cts.Cancel();
    }

    private static async Task WriteEventAsync(Stream stream, string eventName, string data, CancellationToken ct)
    {
        var bytes = Encoding.UTF8.GetBytes($"event: {eventName}\ndata: {data}\n\n");
        await stream.WriteAsync(bytes, ct);
        await stream.FlushAsync(ct);
    }
}

public record SseClient(Stream Stream, CancellationTokenSource Cts);
public record ComplaintNotifyRequest(string? Id, string? Branch, string? City, string? Notes);
