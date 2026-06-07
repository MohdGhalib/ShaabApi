using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

/// <summary>
/// Shadow per-record copy of an employee (kept in sync from Shaab_Employees_DB blob).
/// The blob remains the source of truth for AUTH (login still reads it). This table
/// backs GET /api/employees so the mobile app can read the roster/branches per-record
/// instead of pulling the whole blob. Secrets (salt/passwordHash) are stored here for
/// fidelity but are NEVER returned by the read endpoint.
/// </summary>
[Table("employees")]
public class Employee
{
    [Key]
    [Column("emp_id")]
    [MaxLength(20)]
    public string EmpId { get; set; } = string.Empty;

    [Column("name")]  [MaxLength(100)] public string? Name  { get; set; }
    [Column("title")] [MaxLength(100)] public string? Title { get; set; }
    [Column("salt")]          [MaxLength(64)]  public string? Salt         { get; set; }
    [Column("password_hash")] [MaxLength(200)] public string? PasswordHash { get; set; }

    // extras: assignedBranches, assignedBranch, photo, addedBy, id, …
    [Column("data", TypeName = "json")]
    public string? Data { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
