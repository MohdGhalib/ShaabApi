using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ShaabApi.Controllers;

/// <summary>
/// Video storage (Option 1: filesystem, NOT a DB blob). Large videos live as files
/// on disk under MEDIA_ROOT/videos and are referenced by the small capability URL
/// /api/videos/{id} — exactly like /api/files/{id} for images, except the heavy bytes
/// stay out of MySQL so the SQL dump stays tiny. The backup script mirrors the media
/// folder next to the SQL zip (see backup/shaab-backup.ps1).
///
/// Why disk, not MEDIUMBLOB: videos routinely exceed the 16MB blob cap, blow up
/// mysqldump size/time, and would need a raised max_allowed_packet. Files on disk
/// stream with HTTP range requests (seeking) and back up incrementally via robocopy.
/// </summary>
[ApiController]
[Route("api/videos")]
public class VideosController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    // 200MB default cap; override with MAX_VIDEO_BYTES env var.
    private static readonly long MaxBytes =
        long.TryParse(Environment.GetEnvironmentVariable("MAX_VIDEO_BYTES"), out var m) && m > 0
            ? m : 200L * 1024 * 1024;

    // extension → mime (allowlist). Keys are the only extensions we accept.
    private static readonly Dictionary<string, string> _allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        [".mp4"]  = "video/mp4",
        [".m4v"]  = "video/mp4",
        [".webm"] = "video/webm",
        [".ogg"]  = "video/ogg",
        [".ogv"]  = "video/ogg",
        [".mov"]  = "video/quicktime",
    };

    public VideosController(IWebHostEnvironment env) { _env = env; }

    // MEDIA_ROOT/videos — created on first upload, mirrored by the backup script.
    private string VideosDir
    {
        get
        {
            var root = Environment.GetEnvironmentVariable("MEDIA_ROOT");
            if (string.IsNullOrWhiteSpace(root))
                root = Path.Combine(_env.ContentRootPath, "media");
            return Path.Combine(root, "videos");
        }
    }

    /// <summary>Upload one video (multipart/form-data field "file"). Returns { id, url }.</summary>
    [HttpPost]
    [Authorize]
    [RequestSizeLimit(220_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 220_000_000)]
    public async Task<IActionResult> Upload([FromForm] IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "no file provided" });
        if (file.Length > MaxBytes)
            return StatusCode(413, new { error = "file too large", maxBytes = MaxBytes, size = file.Length });

        var ext = Path.GetExtension(file.FileName ?? "").Trim();
        if (!_allowed.TryGetValue(ext, out var mime))
            return BadRequest(new { error = "unsupported video type", ext });

        var id   = Guid.NewGuid().ToString("N"); // 32 hex chars — unguessable capability URL
        var dir  = VideosDir;
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, id + ext.ToLowerInvariant());

        await using (var fs = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await file.CopyToAsync(fs);
        }

        return Ok(new { ok = true, id, url = $"/api/videos/{id}", size = file.Length, mime });
    }

    /// <summary>Stream a video by id. Public capability URL (unguessable GUID), seekable (range), cached 1 year.</summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public IActionResult Get(string id)
    {
        // id is a 32-char hex GUID; reject anything that could escape the folder.
        if (string.IsNullOrWhiteSpace(id) || id.Length != 32 || !IsHex(id))
            return NotFound();

        var dir = VideosDir;
        if (!Directory.Exists(dir)) return NotFound();

        // find "{id}.{ext}" — the extension carries the mime; id is unique.
        var match = Directory.EnumerateFiles(dir, id + ".*").FirstOrDefault();
        if (match == null) return NotFound();

        var mime = _allowed.TryGetValue(Path.GetExtension(match), out var m) ? m : "application/octet-stream";

        Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        // enableRangeProcessing: lets the browser seek without downloading the whole file.
        return PhysicalFile(match, mime, enableRangeProcessing: true);
    }

    private static bool IsHex(string s)
    {
        foreach (var c in s)
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')))
                return false;
        return true;
    }
}
