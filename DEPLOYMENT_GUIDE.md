# 🚀 دليل تركيب موقع «محامص الشعب» على سيرفر داخلي
### دليل كامل خطوة بخطوة — لا يفترض خبرة مسبقة بالمشروع

> اقرأ الدليل **كاملاً مرة واحدة** قبل البدء. نفّذ الأقسام **بالترتيب**.
> الأقسام المعلَّمة بـ ⚠️ حسّاسة — لا تتجاوزها.

---

## 0) ما هو هذا النظام؟ (لتفهم ما تركّبه)
- **تطبيق واحد** مكتوب بـ **.NET 8 (ASP.NET Core)** اسمه `ShaabApi`.
- هذا التطبيق يقوم بـ **شيئين معاً**: يخدم واجهة الموقع (HTML/JS) **و** الـ API.
- يخزّن البيانات في قاعدة **MySQL**.
- إذن تحتاج 3 أشياء فقط على السيرفر: **MySQL** + **بيئة تشغيل .NET 8** + **ملفات التطبيق**.
- (اختياري) خدمة واتساب Node منفصلة — ليست ضرورية لعمل الموقع.

---

## 1) متطلّبات السيرفر — ثبّت هذه أولاً

| المكوّن | التفاصيل |
|---|---|
| نظام التشغيل | Windows Server (مفضّل لبيئتكم) أو Linux |
| **.NET 8 ASP.NET Core Runtime** | حمّله من: https://dotnet.microsoft.com/download/dotnet/8.0 — اختر **ASP.NET Core Runtime 8** (ليس SDK، إلا إن أردت البناء على السيرفر). تحقّق بعد التثبيت: `dotnet --info` |
| **MySQL Server 8.x** | https://dev.mysql.com/downloads/mysql/ — أو MariaDB 10.5+. شغّل الخدمة بعد التثبيت. |
| (اختياري) Node.js 18+ | فقط إن أردت تشغيل خدمة واتساب |

> 💡 بديل: إن كان لديك **Docker** فلا تحتاج تثبيت .NET — انظر القسم 6-ب.

---

## 2) إعداد قاعدة البيانات ⚠️

التطبيق **يُنشئ كل الجداول تلقائياً** عند أول تشغيل. أنت فقط تُنشئ **القاعدة + مستخدم**.

افتح MySQL (مثلاً `mysql -u root -p`) ونفّذ:
```sql
CREATE DATABASE shaab_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'shaab'@'localhost' IDENTIFIED BY 'ضع_كلمة_مرور_قوية_هنا';
GRANT ALL PRIVILEGES ON shaab_db.* TO 'shaab'@'localhost';
FLUSH PRIVILEGES;
```
> احفظ كلمة مرور القاعدة — ستحتاجها في القسم 4.
> لا حاجة لتشغيل `setup.sql` يدوياً؛ التطبيق ينشئ كل جدول بنفسه عند الإقلاع.

---

## 3) تجهيز ملفات التطبيق

**أ) إن كان لديك الكود المصدري + .NET SDK:**
```powershell
cd مسار-المشروع
dotnet publish ShaabApi.csproj -c Release -o C:\ShaabApp
```
ينتج مجلد `C:\ShaabApp` يحوي `ShaabApi.dll` + ملفات الموقع (index.html, js, css...). **هذا هو كل ما تنشره.**

**ب) إن استلمت مجلد منشور جاهز:** ضعه مثلاً في `C:\ShaabApp`.

---

## 4) ضبط الأسرار ومتغيّرات البيئة ⚠️ (أهم قسم)

التطبيق يقرأ إعداداته من **متغيّرات البيئة** (Environment Variables) — وليس من ملف الكود.
هذه القيم **إلزامية**؛ بدونها لن يعمل (مصمَّم ليرفض الإقلاع بأسرار ناقصة):

| المتغيّر | القيمة |
|---|---|
| `ConnectionStrings__DefaultConnection` | `Server=localhost;Port=3306;Database=shaab_db;User=shaab;Password=كلمة_مرور_القاعدة;CharSet=utf8mb4;` |
| `SuperAdminPassword` | كلمة دخول مدير النظام (السوبر أدمن) — **تُحدّدها الإدارة سرّاً** (غير مدوّنة هنا) |
| `AdminPasswordHash` | `8e5fe6d011f3e8594da9a40337bf1007107d014ee56afd1e084205062c3efbf5` |
| `Jwt__Key` | سرّ عشوائي 32+ حرف (موجود جاهز في ملف `.env`) |
| `Jwt__Issuer` | `ShaabApi` |
| `SseToken` | سرّ عشوائي (في `.env`) |
| `ALLOWED_ORIGINS` | عنوان الموقع الذي سيكتبه المستخدمون، مثل `http://192.168.1.50:8080` ⚠️ |
| `PORT` | `8080` (أو أي منفذ تريده) |

> 📄 **ملف `.env` المرفق** يحتوي `Jwt__Key` و`SseToken` مولّدة جاهزة. كلمة مرور السوبر أدمن تضعها الإدارة (placeholder).
> لتوليد كل شيء من الصفر بدل ذلك: شغّل `setup-local-server.ps1` على السيرفر.

### كيف تضبطها فعلياً؟ (اختر طريقة)

**طريقة 1 — متغيّرات نظام دائمة (PowerShell كمسؤول):**
```powershell
[Environment]::SetEnvironmentVariable('ConnectionStrings__DefaultConnection','Server=localhost;Port=3306;Database=shaab_db;User=shaab;Password=PASS;CharSet=utf8mb4;','Machine')
[Environment]::SetEnvironmentVariable('SuperAdminPassword','<كلمة-السوبر-أدمن-من-الإدارة>','Machine')
[Environment]::SetEnvironmentVariable('AdminPasswordHash','8e5fe6d011f3e8594da9a40337bf1007107d014ee56afd1e084205062c3efbf5','Machine')
[Environment]::SetEnvironmentVariable('Jwt__Key','<انسخه من .env>','Machine')
[Environment]::SetEnvironmentVariable('SseToken','<انسخه من .env>','Machine')
[Environment]::SetEnvironmentVariable('ALLOWED_ORIGINS','http://192.168.1.50:8080','Machine')
[Environment]::SetEnvironmentVariable('PORT','8080','Machine')
# (اختياري) مجلد الوسائط — مكان حفظ الفيديوهات المرفوعة على القرص. الافتراضي: مجلد media بجانب التطبيق.
[Environment]::SetEnvironmentVariable('MEDIA_ROOT','C:\ShaabApp\media','Machine')
# (اختياري) الحد الأقصى لحجم الفيديو بالبايت — الافتراضي 200MB.
[Environment]::SetEnvironmentVariable('MAX_VIDEO_BYTES','209715200','Machine')
```
ثم **أعد فتح** نافذة PowerShell (لتُحمَّل المتغيّرات).

**طريقة 2 — تحميل من ملف `.env` قبل التشغيل (لكل جلسة):**
```powershell
Get-Content C:\ShaabApp\.env | ForEach-Object {
  if ($_ -and $_ -notmatch '^\s*#') { $k,$v = $_ -split '=',2; [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim()) }
}
```

> ⚠️ ضع ملف `.env` **خارج** أي مجلد يُخدَم للويب، واحمِه بصلاحيات الملفات. لا ترفعه لأي مكان.

---

## 5) تشغيل تجريبي أول (للتأكد)

```powershell
cd C:\ShaabApp
dotnet ShaabApi.dll
```
يجب أن ترى أسطراً مثل `Now listening on: http://0.0.0.0:8080` وإنشاء الجداول.
افتح المتصفّح على `http://localhost:8080` — يجب أن تظهر شاشة الدخول.
أوقفه بـ `Ctrl+C` بعد التأكد، ثم انتقل للتشغيل الدائم.

> ❌ ظهر خطأ اتصال بقاعدة البيانات؟ راجع `ConnectionStrings__DefaultConnection` وأن خدمة MySQL تعمل.
> ❌ شاشة بيضاء/الدخول لا يقبل السوبر أدمن؟ غالباً المتغيّرات لم تُحمَّل — راجع القسم 4.

---

## 6) التشغيل الدائم (اختر واحدة)

**أ) كخدمة Windows (موصى به):** استخدم [NSSM](https://nssm.cc/):
```powershell
nssm install ShaabApi "C:\Program Files\dotnet\dotnet.exe" "C:\ShaabApp\ShaabApi.dll"
nssm set ShaabApi AppDirectory C:\ShaabApp
nssm start ShaabApi
```
(المتغيّرات من طريقة 1 «Machine» تُورَّث تلقائياً للخدمة.)

**ب) عبر Docker (بديل):**
```bash
docker build -t shaabapi .
docker run -d --name shaabapi --env-file .env -p 8080:8080 --restart unless-stopped shaabapi
```
> ملاحظة: داخل Docker، اجعل `Server=` في الاتصال يشير لعنوان MySQL الفعلي (ليس localhost إن كانت القاعدة خارج الحاوية).

---

## 7) الشبكة والوصول ⚠️
1. **افتح المنفذ** في جدار الحماية (مثلاً 8080):
   ```powershell
   New-NetFirewallRule -DisplayName "ShaabApi" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
   ```
2. **عنوان ثابت:** أعطِ السيرفر IP ثابتاً (مثلاً `192.168.1.50`) أو اسم مضيف داخلي.
3. **⚠️ `ALLOWED_ORIGINS` يجب أن يطابق تماماً** ما يكتبه المستخدم في المتصفّح (البروتوكول + العنوان + المنفذ). إن دخلوا عبر `http://192.168.1.50:8080` فاجعلها كذلك بالضبط، وإلا تُرفض الطلبات (CORS).
4. (اختياري) **HTTPS:** ضع التطبيق خلف **IIS/Nginx كوسيط عكسي (reverse proxy)** بشهادة داخلية، ووجّهه إلى `http://localhost:8080`.
5. **رفع الفيديو (حجم الطلب):** يسمح التطبيق برفع فيديو حتى **220MB**.
   - تشغيل مباشر بـ Kestrel/NSSM: يعمل دون إعداد إضافي.
   - **خلف IIS**: الافتراضي يرفض الطلبات الأكبر من ~28.6MB بخطأ `404.13`. ملف `web.config` المرفق يرفع الحد إلى 220MB عبر `requestFiltering/requestLimits` — تأكّد من نشره. لرفع حد أكبر، عدّل `maxAllowedContentLength` (بالبايت).
   - خلف **Nginx**: ارفع `client_max_body_size 220m;`.

---

## 8) التحقق النهائي بعد التشغيل
- [ ] الموقع يفتح من جهاز **آخر** على الشبكة: `http://192.168.1.50:8080`
- [ ] **شاشة تسجيل الدخول تظهر** بشكل صحيح (الواجهة تعمل)
- [ ] لا أخطاء قاعدة بيانات في سجلّ الإقلاع (الجداول أُنشئت بنجاح)

> التحقق من تسجيل الدخول الفعلي وإنشاء السجلات تقوم به **الإدارة** — بيانات الدخول خارج مهمّة الفنّي.

---

## 9) الإشعارات (Firebase) — اختياري
الإشعارات الفورية تحتاج مفتاح خدمة Firebase. إن لم تكن مطلوبة داخلياً، **تجاهل هذا القسم** — كل شيء آخر يعمل بدونها. لتفعيلها لاحقاً: يُخزَّن مفتاح الخدمة في قاعدة البيانات تحت مفتاح `Shaab_Firebase_Creds` (راجِع المطوّر).

---

## 10) النسخ الاحتياطي ⚠️ (لا تتجاهله)
يأتي المشروع بسكربتات نسخ جاهزة في مجلد `backup/` — استخدمها بدل الأوامر اليدوية:

**ماذا يشمل الباكب؟**
- **قاعدة البيانات** كاملة عبر `mysqldump` (يتضمّن **الصور** المخزّنة كـ blob في جدول `files` بأمان عبر `--hex-blob`).
- **مجلد الوسائط `media/`** الذي يحوي **الفيديوهات** المرفوعة (مخزّنة كملفات على القرص، خارج قاعدة البيانات). يُنسخ كمرآة (robocopy) بجانب نسخة الـ SQL.

**الإعداد (مرة واحدة):** عدّل `backup/backup-config.ps1`:
- بيانات اتصال قاعدة البيانات (`$DbName`/`$DbUser`/`$DbPassword`).
- `$MediaDir` = مسار مجلد `media` للتطبيق (نفس قيمة `MEDIA_ROOT`، مثلاً `C:\ShaabApp\media`). اتركه `''` للاكتشاف التلقائي.
- `$BackupDir` (وجهة النسخ) و`$OffsiteDir` (نسخة على جهاز/قرص آخر — موصى بها).

**التشغيل اليدوي:**
```powershell
powershell -ExecutionPolicy Bypass -File C:\ShaabApp\backup\shaab-backup.ps1
```

**الجدولة:** أنشئ **مهمة مجدوَلة (Task Scheduler)** تشغّل السكربت يومياً. السكربت يحتفظ تلقائياً بآخر `$RetentionDays` يوماً (افتراضياً 30) ويحذف الأقدم.

**الاستعادة** (تستعيد القاعدة + الفيديوهات معاً):
```powershell
powershell -ExecutionPolicy Bypass -File C:\ShaabApp\backup\shaab-restore.ps1 -ZipPath "C:\ShaabBackups\shaab_db_<التاريخ>.zip"
```
> ⚠️ **اختبر الاستعادة** مرة على الأقل على بيئة تجريبية للتأكد من سلامة النسخ (القاعدة + الفيديوهات).

---

## 11) الصيانة والتحديث
- **السجلّات (logs):** تظهر في مخرجات الخدمة/الحاوية. مع NSSM يمكن توجيهها لملف.
- **إعادة التشغيل:** `nssm restart ShaabApi` (أو `docker restart shaabapi`).
- **تحديث الموقع:** انشر نسخة جديدة فوق `C:\ShaabApp` ثم أعد تشغيل الخدمة. (التطبيق يمنع تخزين `index.html` في الكاش، والتحديثات تصل عبر أرقام `?v=` في `index.html`.)
- ترقيات قاعدة البيانات تتم تلقائياً عند الإقلاع (أعمدة/جداول جديدة).

---

## 12) قائمة الأمان النهائية ⚠️
- [ ] كلمة مرور السوبر أدمن حدّدتها الإدارة سرّاً (غير مدوّنة في أي وثيقة تُسلَّم للفنّي).
- [ ] ملف `.env` محمي بصلاحيات، وغير مخدوم للويب، وغير مرفوع لـ git.
- [ ] كلمة مرور قاعدة البيانات قوية وغير افتراضية.
- [ ] جدار الحماية يسمح بالمنفذ المطلوب فقط.
- [ ] (اختياري) HTTPS عبر وسيط عكسي.
- [ ] (اختياري) مسح أسرار قديمة من تاريخ git — راجِع `SECURITY_HISTORY_SCRUB.md`.
- [ ] النسخ الاحتياطي اليومي يعمل ومُختبَر (جرّب استعادة نسخة).

---

## 13) حلّ المشكلات الشائعة
| العرض | السبب الغالب | الحل |
|---|---|---|
| الدخول لا يقبل السوبر أدمن | المتغيّرات لم تُحمَّل | أعد ضبط القسم 4 وأعد تشغيل الخدمة |
| خطأ اتصال DB عند الإقلاع | اتصال خاطئ/MySQL متوقّف | تحقّق من السلسلة وخدمة MySQL |
| الصفحة تفتح لكن لا تحفظ / أخطاء في الكونسول | `ALLOWED_ORIGINS` لا يطابق العنوان | اجعلها مطابقة تماماً لعنوان المتصفّح |
| `Address already in use` | المنفذ مشغول | غيّر `PORT` أو أوقف ما يستخدمه |
| صفحة 404 للواجهة | نشر ناقص | تأكّد أن `index.html`/`js`/`css` موجودة في مجلد النشر |

---

### ملاحظة: بيانات الدخول خارج مهمّة الفنّي
الفنّي يضبط البنية التحتية فقط (قاعدة البيانات + المتغيّرات). كل حسابات الدخول (مدير النظام والموظفون) تديرها **الإدارة** وحدها بعد التركيب.

> عند أي غموض تقني عميق (Firebase / تفاصيل المخطط)، راجِع `ENV_SETUP.md` و`SECURITY_HISTORY_SCRUB.md` في نفس المجلد، أو تواصل مع المطوّر.
