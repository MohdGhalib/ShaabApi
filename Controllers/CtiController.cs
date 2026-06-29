using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ShaabApi.Controllers;

/// <summary>
/// جسر المقسم (Panasonic KX-NS500 CTI). برنامج الجسر المحلي يستدعي
/// POST /api/cti/incoming-call عند ورود مكالمة، فيُبَثّ حدث SSE 'incoming-call'
/// لجميع المتصفحات، والواجهة توجّهه للموظف المعني (بالتحويلة) وتعرض ملف الزبون.
///
/// المصادقة هنا بمفتاح مشترك (رأس X-CTI-Key يطابق Cti:ApiKey / متغير البيئة CTI_API_KEY)
/// لأن الجسر جهاز لا جلسة مستخدم. أما /simulate فيتطلب JWT لاختبار الميزة من داخل النظام.
/// </summary>
[ApiController]
[Route("api/cti")]
public class CtiController : ControllerBase
{
    private readonly IConfiguration _config;
    public CtiController(IConfiguration config) { _config = config; }

    private static string Normalize(string? p) =>
        Regex.Replace(Regex.Replace(p ?? "", @"[\s\-+()]", ""), @"^0+", "");

    private string? ConfiguredKey() =>
        Environment.GetEnvironmentVariable("CTI_API_KEY") ?? _config["Cti:ApiKey"];

    // POST /api/cti/incoming-call  (يُستدعى من برنامج الجسر)
    // الرأس: X-CTI-Key: <المفتاح>   الجسم: { "phone": "...", "ext": "102" }
    [HttpPost("incoming-call")]
    public async Task<IActionResult> IncomingCall([FromBody] CtiCallRequest? body)
    {
        var key = ConfiguredKey();
        // إن لم يُضبط المفتاح إطلاقاً → ارفض (لا نسمح ببثّ مجهول المصدر)
        if (string.IsNullOrEmpty(key)) return StatusCode(503, new { error = "CTI not configured" });

        var provided = Request.Headers["X-CTI-Key"].ToString();
        if (provided != key) return Unauthorized();

        await BroadcastCall(body?.Phone, body?.Ext);
        return Ok(new { ok = true });
    }

    // POST /api/cti/simulate  (اختبار من داخل النظام — JWT لطاقم الكول سنتر/الأدمن)
    [HttpPost("simulate")]
    [Authorize]
    public async Task<IActionResult> Simulate([FromBody] CtiCallRequest? body)
    {
        var role    = User.FindFirst("role")?.Value ?? "";
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        if (!isAdmin && role != "cc_manager" && role != "cc_employee")
            return Forbid();

        await BroadcastCall(body?.Phone, body?.Ext);
        return Ok(new { ok = true });
    }

    // POST /api/cti/make-call  (اتصال صادر — Click-to-Dial)
    // الموظف يطلب الاتصال بزبون؛ يُبَثّ أمر 'make-call' ليلتقطه برنامج الجسر
    // فيأمر المقسم: يرنّ تحويلة الموظف أولاً ثم يطلب رقم الزبون (dial).
    [HttpPost("make-call")]
    [Authorize]
    public async Task<IActionResult> MakeCall([FromBody] CtiMakeCallRequest? body)
    {
        var role    = User.FindFirst("role")?.Value ?? "";
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        if (!isAdmin && role != "cc_manager" && role != "cc_employee")
            return Forbid();

        var ext  = (body?.Ext  ?? "").Trim();
        var dial = (body?.Dial ?? "").Trim();
        if (string.IsNullOrEmpty(ext) || string.IsNullOrEmpty(dial))
            return BadRequest(new { error = "ext and dial required" });

        var payload = JsonSerializer.Serialize(new {
            ext,
            dial,
            phone = (body?.Phone ?? "").Trim(),
            by    = User.FindFirst("name")?.Value ?? "",
            ts    = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
        await SseController.Broadcast("make-call", payload);
        return Ok(new { ok = true });
    }

    private static async Task BroadcastCall(string? rawPhone, string? ext)
    {
        var payload = JsonSerializer.Serialize(new {
            phone = (rawPhone ?? "").Trim(),
            norm  = Normalize(rawPhone),
            ext   = (ext ?? "").Trim(),
            ts    = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
        await SseController.Broadcast("incoming-call", payload);
    }
}

public record CtiCallRequest(string? Phone, string? Ext);
public record CtiMakeCallRequest(string? Ext, string? Phone, string? Dial);
