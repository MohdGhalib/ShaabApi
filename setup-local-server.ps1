<#
  ════════════════════════════════════════════════════════════════
  setup-local-server.ps1
  مُولِّد إعدادات السيرفر المحلي لمشروع ShaabApi.
  - يولّد أسراراً قوية (Jwt__Key / SseToken) ويحسب هاش كلمة مرور المدير.
  - يسألك عن بيانات قاعدة البيانات وعنوان السيرفر.
  - يكتب ملف .env جاهزاً (مُستبعَد من git مسبقاً).

  التشغيل (PowerShell):  ./setup-local-server.ps1
  ════════════════════════════════════════════════════════════════
#>

$ErrorActionPreference = 'Stop'

function New-RandomHex([int]$Bytes = 48) {
    $b = New-Object 'System.Byte[]' $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    -join ($b | ForEach-Object { $_.ToString('x2') })
}
function Get-Sha256Hex([string]$Text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash  = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    -join ($hash | ForEach-Object { $_.ToString('x2') })
}
function Read-Default([string]$Prompt, [string]$Default) {
    $v = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($v)) { return $Default } else { return $v }
}

Write-Host "`n=== إعداد سيرفر ShaabApi المحلي ===`n" -ForegroundColor Cyan

$envPath = Join-Path $PSScriptRoot '.env'
if (Test-Path $envPath) {
    $ans = Read-Host "⚠️ يوجد .env بالفعل. الكتابة فوقه؟ (y/N)"
    if ($ans -ne 'y') { Write-Host 'أُلغيت العملية.' -ForegroundColor Yellow; exit }
}

# ── 1) قاعدة البيانات ──
Write-Host '— بيانات قاعدة البيانات MySQL —' -ForegroundColor Green
$dbHost = Read-Default 'العنوان (host)'  'localhost'
$dbPort = Read-Default 'المنفذ (port)'   '3306'
$dbName = Read-Default 'اسم القاعدة'     'shaab_db'
$dbUser = Read-Default 'المستخدم'        'shaab'
$dbPass = Read-Host    'كلمة مرور القاعدة'
$conn   = "Server=$dbHost;Port=$dbPort;Database=$dbName;User=$dbUser;Password=$dbPass;CharSet=utf8mb4;"

# ── 2) عنوان السيرفر (CORS) ──
Write-Host "`n— عنوان الوصول للموقع (CORS) —" -ForegroundColor Green
Write-Host '  مثال: http://192.168.1.10  أو  http://shaab.local'
$origins = Read-Default 'ALLOWED_ORIGINS (افصل بفواصل لعدة عناوين)' 'http://localhost:8080'

# ── 3) كلمة مرور السوبر أدمن ──
Write-Host "`n— كلمة مرور السوبر أدمن (090999797269 سابقاً) —" -ForegroundColor Green
$saIn = Read-Host 'أدخل كلمة مرور قوية جديدة (اتركها فارغة لتوليد عشوائية)'
if ([string]::IsNullOrWhiteSpace($saIn)) { $saPwd = New-RandomHex 8; $saGen = $true } else { $saPwd = $saIn; $saGen = $false }

# ── 4) كلمة مرور المدير الرئيسي (admin) ──
Write-Host "`n— كلمة مرور المدير الرئيسي (حساب admin) —" -ForegroundColor Green
$adIn = Read-Host 'أدخل كلمة مرور قوية جديدة (اتركها فارغة لتوليد عشوائية)'
if ([string]::IsNullOrWhiteSpace($adIn)) { $adPwd = New-RandomHex 8; $adGen = $true } else { $adPwd = $adIn; $adGen = $false }
$adHash = Get-Sha256Hex $adPwd

# ── 5) أسرار مولّدة ──
$jwtKey   = New-RandomHex 48   # 96 hex chars
$sseToken = New-RandomHex 24

# ── كتابة .env ──
$lines = @(
    '# مُولّد بواسطة setup-local-server.ps1 — لا ترفعه إلى git',
    "ConnectionStrings__DefaultConnection=$conn",
    "Jwt__Key=$jwtKey",
    'Jwt__Issuer=ShaabApi',
    'Jwt__ExpiryHours=12',
    "SuperAdminPassword=$saPwd",
    "AdminPasswordHash=$adHash",
    "SseToken=$sseToken",
    "ALLOWED_ORIGINS=$origins"
)
Set-Content -Path $envPath -Value $lines -Encoding UTF8

# ── ملخّص ──
Write-Host "`n✓ تم إنشاء: $envPath" -ForegroundColor Green
Write-Host "`n════════ احفظ هذه القيم في مكان آمن ════════" -ForegroundColor Yellow
Write-Host ("كلمة مرور السوبر أدمن : {0} {1}" -f $saPwd, $(if($saGen){'(مولّدة)'}else{''}))
Write-Host ("كلمة مرور المدير      : {0} {1}" -f $adPwd, $(if($adGen){'(مولّدة)'}else{''}))
Write-Host  "هاش المدير (AdminPasswordHash) : $adHash"
Write-Host  "Jwt__Key   : $jwtKey"
Write-Host  "SseToken   : $sseToken"
Write-Host "════════════════════════════════════════════`n" -ForegroundColor Yellow

Write-Host 'التشغيل: حمّل .env كمتغيّرات بيئة ثم شغّل التطبيق. أمثلة:' -ForegroundColor Cyan
Write-Host '  • Docker:  docker run --env-file .env ...'
Write-Host '  • خدمة Windows: اضبطها كمتغيّرات نظام (System Environment Variables)'
Write-Host '  • تطوير محلي:  Get-Content .env | % { if($_ -notmatch "^#" -and $_){ $k,$v=$_-split "=",2; [Environment]::SetEnvironmentVariable($k,$v) } }; dotnet run'
