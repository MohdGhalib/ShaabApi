# النسخ الاحتياطي للسيرفر الداخلي — Shaab DB

نسخ احتياطي على مستوى قاعدة البيانات (MySQL) — **يشمل كل شيء بما فيه جدول الصور `files`** (البايتات نفسها، لا الروابط فقط). مستقل عن التطبيق ومتصفّح المدير.

> القاعدة الذهبية **3-2-1**: ٣ نسخ، على وسيطين مختلفين، واحدة منها خارج الموقع.

---

## المتطلّبات
- أدوات MySQL مثبّتة على السيرفر (`mysqldump.exe` و`mysql.exe`). تأتي مع MySQL Server أو حزمة MySQL Shell/Client.
- تأكّد أنها في `PATH`، أو ضع المسار الكامل في رأس السكربتات (`$MysqlDump` / `$Mysql`).

## الإعداد (مرّة واحدة)
افتح `shaab-backup.ps1` وعدّل عند اللزوم:
- **الاتصال:** يُقرأ تلقائياً من متغيّرات بيئة التطبيق (`MYSQL_HOST`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`...). إن لم تكن مضبوطة، اكتب القيم في رأس الملف.
- `$BackupDir` — مجلد النسخ الأساسي (مثلاً `C:\ShaabBackups`).
- `$OffsiteDir` — مجلد **خارج الموقع** (قرص خارجي/NAS/مجلد مزامنة سحابية). اتركه فارغاً للتعطيل.
- `$RetentionDays` — كم يوماً نحتفظ (الأقدم يُحذف).

> 🔒 احمِ مجلد السكربتات بصلاحيات NTFS (يحوي كلمة مرور القاعدة لو لم تستخدم متغيّرات البيئة).

## تشغيل يدوي (اختبار)
```powershell
powershell -ExecutionPolicy Bypass -File "C:\path\to\backup\shaab-backup.ps1"
```
يُنتج `C:\ShaabBackups\shaab_db_<التاريخ>.zip` ويكتب `backup.log`.

---

## الجدولة التلقائية (Windows Task Scheduler)

### الخيار أ — أمر جاهز (شغّله كمسؤول، PowerShell):
نسخة **يومية الساعة 3:00 فجراً**:
```powershell
schtasks /Create /SC DAILY /ST 03:00 /TN "ShaabDB Backup Daily" /RU SYSTEM ^
  /TR "powershell -ExecutionPolicy Bypass -NoProfile -File \"C:\path\to\backup\shaab-backup.ps1\""
```
نسخة إضافية **كل ساعة** (حماية أقوى):
```powershell
schtasks /Create /SC HOURLY /TN "ShaabDB Backup Hourly" /RU SYSTEM ^
  /TR "powershell -ExecutionPolicy Bypass -NoProfile -File \"C:\path\to\backup\shaab-backup.ps1\""
```
> استبدل `C:\path\to\backup\` بالمسار الفعلي على السيرفر.
> `/RU SYSTEM` يشغّلها بلا تسجيل دخول. إن احتجت متغيّرات بيئة المستخدم، استخدم حساب الخدمة بدلها.

### الخيار ب — واجهة Task Scheduler:
1. Create Task → Triggers: Daily 03:00 (و/أو Hourly).
2. Actions → Program: `powershell.exe`
   Arguments: `-ExecutionPolicy Bypass -NoProfile -File "C:\path\to\backup\shaab-backup.ps1"`
3. General → "Run whether user is logged on or not".

### تحقّق:
```powershell
schtasks /Run /TN "ShaabDB Backup Daily"
Get-Content C:\ShaabBackups\backup.log -Tail 20
```

---

## الاستعادة (عند الحاجة)
⚠️ تستبدل القاعدة الحالية بالكامل. أوقف التطبيق أولاً يُفضّل.
```powershell
powershell -ExecutionPolicy Bypass -File "C:\path\to\backup\shaab-restore.ps1" -ZipPath "C:\ShaabBackups\shaab_db_2026-06-09_03-00-00.zip"
```
ثم أعد تشغيل التطبيق.

> **اختبر الاستعادة دورياً** على قاعدة تجريبية — نسخة لم تُختبَر = لا نسخة.

---

## ما يغطّيه هذا الباكب
✅ كل الجداول: `storage` (Master_DB blob) · `montasiat` · `inquiries` · `complaints` · `messages` · `audit_log` · `employees` · **`files` (الصور الثنائية)** · والإجراءات/المشغّلات.

## ملاحظات
- الباكب داخل التطبيق (لقطات localStorage للمدير) **يبقى كطبقة راحة سريعة**، لكن الأساس والأضمن هو هذا (`mysqldump`).
- تأكّد أن وجهة "خارج الموقع" تُفصل فعلاً أو تُزامَن خارج السيرفر — حماية من حريق/سرقة/تلف القرص.
