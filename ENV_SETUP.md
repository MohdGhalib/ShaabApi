# 🔐 ضبط الأسرار ومتغيّرات البيئة

هذا الدليل يشرح كيف تنقل كل الأسرار من الكود إلى متغيّرات البيئة، وتنظّف ما تسرّب.
الكود يقرأ هذه القيم من البيئة تلقائياً (تتغلّب على ملفات `appsettings`).

## 1) المتغيّرات المطلوبة
انظر `.env.example` للقائمة الكاملة. الأهم:
`ConnectionStrings__DefaultConnection`, `Jwt__Key`, `AdminPanelPassword`,
`SuperAdminPassword`, `AdminPasswordHash`, `SseToken`, `ALLOWED_ORIGINS`, `WA_SECRET`.

## 2) على السيرفر الداخلي
- إن شغّلت كحاوية Docker: مرّر `--env-file .env` أو `-e KEY=VALUE`.
- إن شغّلت كخدمة Windows/IIS: اضبطها كمتغيّرات نظام، أو استخدم
  `dotnet user-secrets` للتطوير المحلي.
- ضع `.env` خارج مجلد الموقع (غير مخدوم) أو اعتمد على متغيّرات النظام.

## 3) على Railway (الحالي) — افعل هذا قبل أي دفع يفرّغ appsettings
في لوحة Railway → Variables، أضِف: `AdminPanelPassword`, `SuperAdminPassword`,
`AdminPasswordHash`, `Jwt__Key`, `SseToken` (والاتصال إن لم يكن مضبوطاً).
**بعد** التأكد أنها مضبوطة وأن الدخول يعمل، يمكن تفريغ القيم من `appsettings`.

## 4) تدوير الأسرار المسرّبة (إلزامي — موجودة في تاريخ git)
كل هذه ظهرت في الكود/التاريخ فيجب تغييرها لقيم جديدة، لا مجرد حذفها:
- كلمة مرور لوحة التحكم `0785110515`
- كلمة مرور السوبر-أدمن `090999797269`
- `AdminPasswordHash` (8e5fe6…) → احسب SHA-256 لكلمة المرور الجديدة
- سرّ واتساب `shaab-wa-secret`

> كلمة السوبر-أدمن لا تزال مكتوبة في `js/lockdown.js` و`js/auth.js`
> (إصلاح منفصل ضمن المهمة "أ").

## 5) إزالة الملفات المتتبَّعة التي لا يجب تتبّعها
```bash
git rm -r --cached whatsapp-service/node_modules whatsapp-service/daemon
git rm -r --cached "نظام ادارة محامص الشعب"   # نسخة مكرّرة بأسرار مكرّرة — تأكد أنها غير مستخدمة
git commit -m "chore: untrack node_modules, binaries, and stale duplicate"
```

## 6) مسح الأسرار من تاريخ git (بعد التدوير)
بما أن الأسرار في التزامات سابقة، نظّف التاريخ بأداة مثل
`git filter-repo` أو BFG، ثم ادفع بقوة (force) — نسّق مع أي متعاون أولاً.
