using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

/// <summary>
/// "ملاحظات مدراء مناطق" — a regional-managers note logged by call-center staff.
/// Stored in its own table (like <see cref="Message"/>) off the Master_DB blob so it never
/// bloats saves and can't be clobbered by full-blob writes. Id is the client-generated
/// numeric id (Date.now()+rand) → natural dedup key. Mutable flags (Closed/Deleted) and the
/// closing note are authoritative columns so they can be PATCHed without rewriting Data.
/// </summary>
[Table("manager_notes")]
public class ManagerNote
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("branch")]          [MaxLength(100)] public string? Branch         { get; set; }
    [Column("note_date")]       [MaxLength(30)]  public string? NoteDate       { get; set; } // تاريخ الملاحظة (ISO yyyy-mm-dd)
    [Column("notified_person")] [MaxLength(150)] public string? NotifiedPerson { get; set; } // الشخص الذي تم تبليغه
    [Column("text", TypeName = "text")]          public string? Text           { get; set; } // نص الملاحظة

    [Column("closed")]    public bool Closed { get; set; }                                    // مغلقة؟
    [Column("close_note", TypeName = "text")]    public string? CloseNote      { get; set; } // ملاحظة الإغلاق
    [Column("closed_by")]       [MaxLength(100)] public string? ClosedBy       { get; set; }
    [Column("closed_at")] public long ClosedAt { get; set; }                                  // epoch ms

    [Column("added_by")]        [MaxLength(100)] public string? AddedBy        { get; set; }

    // epoch milliseconds of creation — indexed for ordering / since-Ts queries
    [Column("ts")] public long Ts { get; set; }

    [Column("deleted")] public bool Deleted { get; set; }

    // full original object as sent by the client (forward-compat extras)
    [Column("data", TypeName = "json")]
    public string? Data { get; set; }

    [Column("version")]
    public long Version { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
