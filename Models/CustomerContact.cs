using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShaabApi.Models;

/// <summary>
/// دفتر هاتف الزبائن (Caller-ID phonebook). الـ PK هو الرقم بعد التطبيع
/// (إزالة المسافات و - + ( ) والأصفار البادئة) ليطابق _c360NormalizePhone في الواجهة،
/// فيصبح البحث/الـ upsert على المفتاح مباشرة. <see cref="DisplayPhone"/> يحفظ الصيغة
/// الأصلية كما تُعرض. تُملأ تلقائياً عند أول حفظ يدوي لرقم غير مسجَّل بسجلّات النظام.
/// </summary>
[Table("customer_contacts")]
public class CustomerContact
{
    [Key]
    [Column("phone")]
    [MaxLength(40)]
    public string Phone { get; set; } = "";   // normalized — مفتاح

    [Column("display_phone")] [MaxLength(40)]  public string? DisplayPhone { get; set; }
    [Column("name")]          [MaxLength(150)] public string? Name         { get; set; }
    [Column("city")]          [MaxLength(100)] public string? City         { get; set; }
    [Column("address")]       [MaxLength(255)] public string? Address      { get; set; }
    [Column("notes", TypeName = "text")]       public string? Notes        { get; set; }

    // أي حقول إضافية مستقبلية بلا migration
    [Column("data", TypeName = "json")]
    public string? Data { get; set; }

    [Column("updated_by")] [MaxLength(100)] public string? UpdatedBy { get; set; }

    // epoch milliseconds — آخر تعديل (للدمج last-write-wins إن لزم)
    [Column("updated_ts")]
    public long UpdatedTs { get; set; }

    [Column("version")]
    public long Version { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
