using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Controllers;

/// <summary>
/// Migration #11 (image off-loading). Stores uploaded images/invoices as binary
/// rows in the `files` table and serves them by id. Records reference the small
/// URL /api/files/{id} instead of embedding base64 — keeping the Master_DB blob
/// and per-record JSON tiny.
/// </summary>
[ApiController]
[Route("api/files")]
public class FilesController : ControllerBase
{
    private readonly AppDbContext _db;

    private const int MaxBytes = 12 * 1024 * 1024; // 12MB hard cap (MEDIUMBLOB holds 16MB)

    private static readonly HashSet<string> _allowedMime = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"
    };

    public FilesController(AppDbContext db) { _db = db; }

    /// <summary>Upload one file (multipart/form-data field "file"). Returns { id, url }.</summary>
    [HttpPost]
    [Authorize]
    [RequestSizeLimit(20_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 20_000_000)]
    public async Task<IActionResult> Upload([FromForm] IFormFile? file, [FromForm] string? refType, [FromForm] string? refId)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "no file provided" });
        if (file.Length > MaxBytes)
            return StatusCode(413, new { error = "file too large", maxBytes = MaxBytes, size = file.Length });

        var mime = (file.ContentType ?? "application/octet-stream").Trim();
        if (!_allowedMime.Contains(mime))
            return BadRequest(new { error = "unsupported file type", mime });

        byte[] bytes;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            bytes = ms.ToArray();
        }
        if (bytes.Length == 0) return BadRequest(new { error = "empty file" });

        var id = Guid.NewGuid().ToString("N"); // 32 hex chars — unguessable capability URL
        var entry = new FileBlob
        {
            Id        = id,
            Mime      = mime,
            Data      = bytes,
            SizeBytes = bytes.Length,
            RefType   = string.IsNullOrWhiteSpace(refType) ? null : refType.Trim(),
            RefId     = string.IsNullOrWhiteSpace(refId)   ? null : refId.Trim(),
            CreatedBy = User.FindFirst("empId")?.Value,
            CreatedAt = DateTime.UtcNow
        };
        _db.Files.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true, id, url = $"/api/files/{id}", size = bytes.Length, mime });
    }

    /// <summary>Serve a file by id. Public capability URL (unguessable GUID), cached 1 year.</summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> Get(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || id.Length > 34) return NotFound();

        var f = await _db.Files.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (f == null || f.Data.Length == 0) return NotFound();

        // Content is immutable per id → cache hard so the browser fetches each image once.
        Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
        // defense-in-depth: don't let the browser MIME-sniff a stored file into something executable
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(f.Data, string.IsNullOrEmpty(f.Mime) ? "application/octet-stream" : f.Mime);
    }
}
