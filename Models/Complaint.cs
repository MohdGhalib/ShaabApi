using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

[Table("complaints")]
public class Complaint
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("branch")]
    [MaxLength(100)]
    public string? Branch { get; set; }

    [Column("notes", TypeName = "text")]
    public string? Notes { get; set; }

    [Column("time")]
    [MaxLength(50)]
    public string? Time { get; set; }

    [Column("iso")]
    [MaxLength(50)]
    public string? Iso { get; set; }

    [Column("file", TypeName = "longtext")]
    public string? File { get; set; }

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
