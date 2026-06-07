using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

/// <summary>
/// Migration #11 (image off-loading): a single uploaded image/file (invoice,
/// montasia photo, employee photo, message attachment, …) stored as binary in a
/// dedicated table instead of base64 inside record JSON. Records keep only a small
/// URL (/api/files/{id}); the heavy bytes never ride inside the Master_DB blob.
/// </summary>
[Table("files")]
public class FileBlob
{
    // 32-char hex GUID — unguessable capability URL (/api/files/{id})
    [Key]
    [Column("id")]
    [MaxLength(34)]
    public string Id { get; set; } = string.Empty;

    [Column("mime")]
    [MaxLength(100)]
    public string? Mime { get; set; }

    // MEDIUMBLOB = up to 16MB (covers our ≤10MB images/invoices)
    [Column("data", TypeName = "mediumblob")]
    public byte[] Data { get; set; } = Array.Empty<byte>();

    [Column("size_bytes")]
    public int SizeBytes { get; set; }

    // Optional provenance for future orphan-cleanup (e.g. ref_type=complaint, ref_id=123)
    [Column("ref_type")]
    [MaxLength(30)]
    public string? RefType { get; set; }

    [Column("ref_id")]
    [MaxLength(40)]
    public string? RefId { get; set; }

    [Column("created_by")]
    [MaxLength(100)]
    public string? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
