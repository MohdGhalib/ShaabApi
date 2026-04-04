using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

[Table("storage")]
public class StorageEntry
{
    [Key]
    [Column("store_key")]
    [MaxLength(100)]
    public string StoreKey { get; set; } = string.Empty;

    [Column("store_value", TypeName = "longtext")]
    public string? StoreValue { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
