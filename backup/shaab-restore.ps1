<#
═══════════════════════════════════════════════════════════════════════════
  Shaab DB Restore  —  استعادة قاعدة البيانات من نسخة .zip
═══════════════════════════════════════════════════════════════════════════
  ⚠️ تحذير: يستبدل محتوى القاعدة الحالية بالكامل. أوقف التطبيق أولاً يُفضّل.
  الاستخدام:
    powershell -ExecutionPolicy Bypass -File shaab-restore.ps1 -ZipPath "C:\ShaabBackups\shaab_db_2026-06-09_03-00-00.zip"
═══════════════════════════════════════════════════════════════════════════
#>
param(
    [Parameter(Mandatory=$true)] [string]$ZipPath
)

# نفس إعداد الاتصال في shaab-backup.ps1
$DbHost     = $env:MYSQL_HOST;     if (-not $DbHost)     { $DbHost     = $env:MYSQLHOST };     if (-not $DbHost)     { $DbHost     = 'localhost' }
$DbPort     = $env:MYSQL_PORT;     if (-not $DbPort)     { $DbPort     = $env:MYSQLPORT };     if (-not $DbPort)     { $DbPort     = '3306' }
$DbName     = $env:MYSQLDATABASE;  if (-not $DbName)     { $DbName     = $env:MYSQL_DATABASE };if (-not $DbName)     { $DbName     = 'shaab_db' }
$DbUser     = $env:MYSQLUSER;      if (-not $DbUser)     { $DbUser     = $env:MYSQL_USER };    if (-not $DbUser)     { $DbUser     = 'root' }
$DbPassword = $env:MYSQLPASSWORD;  if (-not $DbPassword) { $DbPassword = $env:MYSQL_PASSWORD };if (-not $DbPassword) { $DbPassword = 'CHANGE_ME_DB_PASSWORD' }
$Mysql      = 'mysql'   # أو المسار الكامل لـ mysql.exe

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ZipPath)) { Write-Error "الملف غير موجود: $ZipPath"; exit 1 }

Write-Host "⚠️  ستُستبدل قاعدة '$DbName' على $DbHost بمحتوى:" -ForegroundColor Yellow
Write-Host "    $ZipPath"
$confirm = Read-Host "اكتب 'YES' للمتابعة"
if ($confirm -ne 'YES') { Write-Host "أُلغيت الاستعادة."; exit 0 }

$tmp = Join-Path $env:TEMP "shaab_restore_$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$cnfFile = Join-Path $env:TEMP "shaab_my_$([guid]::NewGuid().ToString('N')).cnf"
@"
[client]
host=$DbHost
port=$DbPort
user=$DbUser
password=$DbPassword
"@ | Set-Content -Path $cnfFile -Encoding ascii -NoNewline

try {
    Expand-Archive -Path $ZipPath -DestinationPath $tmp -Force
    $sql = Get-ChildItem -Path $tmp -Filter '*.sql' -File | Select-Object -First 1
    if (-not $sql) { throw "لا يوجد ملف .sql داخل الأرشيف" }

    Write-Host "▶ جاري الاستيراد من $($sql.Name) ..."
    # الـ dump أُنشئ بـ --databases فيتضمّن CREATE/USE — لا نمرّر اسم قاعدة
    & $Mysql "--defaults-extra-file=$cnfFile" --default-character-set=utf8mb4 -e "source $($sql.FullName)"
    if ($LASTEXITCODE -ne 0) { throw "mysql فشل برمز $LASTEXITCODE" }

    Write-Host "✅ تمّت الاستعادة بنجاح. أعد تشغيل التطبيق." -ForegroundColor Green
    exit 0
}
catch {
    Write-Error "❌ فشلت الاستعادة: $($_.Exception.Message)"
    exit 1
}
finally {
    if (Test-Path $cnfFile) { try { Remove-Item $cnfFile -Force } catch {} }
    if (Test-Path $tmp)     { try { Remove-Item $tmp -Recurse -Force } catch {} }
}
