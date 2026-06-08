using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

/// <summary>
/// Internal employee message stored in its own table (separated from the Master_DB
/// blob so it never bloats every save and can't be clobbered by full-blob writes).
/// Id is the client-generated numeric id (Date.now()+rand) → natural dedup key.
/// The full original message object lives in <see cref="Data"/> (attachments, replyToId,
/// empIds, interventionPair…); the mutable flags ReadByMe/Deleted are authoritative
/// columns so read/delete state can be PATCHed and propagated without rewriting Data.
/// </summary>
[Table("messages")]
public class Message
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("from_name")] [MaxLength(100)] public string? FromName { get; set; }
    [Column("to_name")]   [MaxLength(100)] public string? ToName   { get; set; }
    [Column("text", TypeName = "text")]    public string? Text     { get; set; }

    // epoch milliseconds — indexed for fast since-Ts queries + retention purge
    [Column("ts")]
    public long Ts { get; set; }

    [Column("read_by_me")]      public bool ReadByMe       { get; set; }
    [Column("deleted")]         public bool Deleted        { get; set; }
    [Column("is_intervention")] public bool IsIntervention { get; set; }

    // full original message object as sent by the client (attachments, replyToId, …)
    [Column("data", TypeName = "json")]
    public string? Data { get; set; }

    [Column("version")]
    public long Version { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
