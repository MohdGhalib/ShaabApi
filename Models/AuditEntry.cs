using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

/// <summary>
/// Audit-log entry stored in its own table (separated from the Master_DB blob so
/// retention can grow to months/years without bloating the blob or every save).
/// Id is the client-generated string id (ts_empId_rand) → natural dedup key.
/// </summary>
[Table("audit_log")]
public class AuditEntry
{
    [Key]
    [Column("id")]
    [MaxLength(80)]
    public string Id { get; set; } = string.Empty;

    [Column("action")]  [MaxLength(50)]  public string? Action  { get; set; }
    [Column("entity")]  [MaxLength(200)] public string? Entity  { get; set; }
    [Column("summary", TypeName = "text")] public string? Summary { get; set; }
    [Column("by_name")] [MaxLength(100)] public string? ByName  { get; set; }
    [Column("emp_id")]  [MaxLength(20)]  public string? EmpId   { get; set; }
    [Column("role")]    [MaxLength(40)]  public string? Role    { get; set; }
    [Column("ref_type")][MaxLength(30)]  public string? RefType { get; set; }
    [Column("ref_id")]  [MaxLength(40)]  public string? RefId   { get; set; }
    [Column("time")]    [MaxLength(50)]  public string? Time    { get; set; }
    [Column("iso")]     [MaxLength(50)]  public string? Iso     { get; set; }

    // epoch milliseconds — indexed for fast date-range queries + retention purge
    [Column("ts")]
    public long Ts { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
