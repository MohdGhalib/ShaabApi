using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

[Table("inquiries")]
public class Inquiry
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("seq")]
    public int? Seq { get; set; }

    [Column("city")]
    [MaxLength(100)]
    public string? City { get; set; }

    [Column("branch")]
    [MaxLength(100)]
    public string? Branch { get; set; }

    [Column("phone")]
    [MaxLength(30)]
    public string? Phone { get; set; }

    [Column("type")]
    [MaxLength(50)]
    public string? Type { get; set; }

    [Column("notes", TypeName = "text")]
    public string? Notes { get; set; }

    [Column("item_name")]
    [MaxLength(200)]
    public string? ItemName { get; set; }

    [Column("offer_name")]
    [MaxLength(200)]
    public string? OfferName { get; set; }

    [Column("quality_photo", TypeName = "longtext")]
    public string? QualityPhoto { get; set; }

    [Column("time")]
    [MaxLength(50)]
    public string? Time { get; set; }

    [Column("iso")]
    [MaxLength(50)]
    public string? Iso { get; set; }

    [Column("added_by")]
    [MaxLength(100)]
    public string? AddedBy { get; set; }

    [Column("data", TypeName = "json")]
    public string? Data { get; set; }

    [Column("version")]
    public long Version { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
