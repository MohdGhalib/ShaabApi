using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShaabApi.Data;
using ShaabApi.Models;

namespace ShaabApi.Controllers;

/// <summary>
/// دفتر هاتف الزبائن (Caller-ID phonebook). يخزّن رقم المتصل ← اسم/بيانات الزبون
/// للأرقام التي لا يلتقطها بحث السجلّات (استفسارات/منتسيات/شكاوى). يُستخدم عند ورود
/// مكالمة لعرض الاسم تلقائياً. الكتابة محصورة بطاقم الكول سنتر والأدمن.
/// </summary>
[ApiController]
[Route("api/contacts")]
[Authorize]
public class ContactsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ContactsController(AppDbContext db) { _db = db; }

    // يطابق _c360NormalizePhone في الواجهة: إزالة المسافات و - + ( ) والأصفار البادئة
    private static string Normalize(string? p) =>
        Regex.Replace(Regex.Replace(p ?? "", @"[\s\-+()]", ""), @"^0+", "");

    private bool CanWrite()
    {
        var role    = User.FindFirst("role")?.Value ?? "";
        var isAdmin = User.FindFirst("isAdmin")?.Value == "true";
        return isAdmin || role == "cc_manager" || role == "cc_employee";
    }

    /// <summary>كل جهات الاتصال — تُحمَّل في الواجهة لمطابقة المكالمات الواردة فوراً.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var list = await _db.CustomerContacts
            .OrderByDescending(c => c.UpdatedTs)
            .Select(c => new {
                phone = c.Phone, displayPhone = c.DisplayPhone, name = c.Name,
                city = c.City, address = c.Address, notes = c.Notes,
                updatedBy = c.UpdatedBy, updatedTs = c.UpdatedTs
            })
            .ToListAsync();
        return Ok(list);
    }

    /// <summary>جهة اتصال واحدة بالرقم (مطبَّع). يُرجع null إن لم تُسجَّل بعد.</summary>
    [HttpGet("{phone}")]
    public async Task<IActionResult> GetOne(string phone)
    {
        var key = Normalize(phone);
        if (key.Length == 0) return Ok((object?)null);
        var c = await _db.CustomerContacts.FirstOrDefaultAsync(x => x.Phone == key);
        if (c == null) return Ok((object?)null);
        return Ok(new {
            phone = c.Phone, displayPhone = c.DisplayPhone, name = c.Name,
            city = c.City, address = c.Address, notes = c.Notes,
            updatedBy = c.UpdatedBy, updatedTs = c.UpdatedTs
        });
    }

    /// <summary>إنشاء/تعديل جهة اتصال (upsert على الرقم المطبَّع).</summary>
    [HttpPost]
    [RequestSizeLimit(200_000)]
    public async Task<IActionResult> Upsert([FromBody] JsonElement body)
    {
        if (!CanWrite()) return Forbid();
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "body must be a JSON object" });

        string S(string k) => body.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? "" : "";

        var display = S("phone").Trim();
        var key     = Normalize(display);
        if (key.Length == 0) return BadRequest(new { error = "phone required" });

        var name    = S("name").Trim();
        var city    = S("city").Trim();
        var address = S("address").Trim();
        var notes   = S("notes").Trim();
        var by      = User.FindFirst("name")?.Value ?? "";
        var now     = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var c = await _db.CustomerContacts.FirstOrDefaultAsync(x => x.Phone == key);
        if (c == null)
        {
            c = new CustomerContact { Phone = key, CreatedAt = DateTime.UtcNow };
            _db.CustomerContacts.Add(c);
        }
        c.DisplayPhone = string.IsNullOrEmpty(display) ? c.DisplayPhone : display;
        c.Name      = name;
        c.City      = city;
        c.Address   = address;
        c.Notes     = notes;
        c.UpdatedBy = by;
        c.UpdatedTs = now;
        c.Version++;

        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            // إدراج متزامن لنفس المفتاح — أعِد المحاولة كتعديل
            _db.Entry(c).State = EntityState.Modified;
            await _db.SaveChangesAsync();
        }

        return Ok(new {
            ok = true,
            contact = new {
                phone = c.Phone, displayPhone = c.DisplayPhone, name = c.Name,
                city = c.City, address = c.Address, notes = c.Notes,
                updatedBy = c.UpdatedBy, updatedTs = c.UpdatedTs
            }
        });
    }
}
