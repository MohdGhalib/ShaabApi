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
    [Parameter(Mandatory=$true)] [string]$ZipPath,
    # مصدر مرآة الوسائط (الفيديوهات). الافتراضي: مجلد media بجوار ملف الـ zip.
    [string]$MediaSource,
    # وجهة الوسائط في التطبيق. الافتراضي من backup-config.ps1 أو media بجذر المشروع.
    [string]$MediaDir
)

# نفس الإعداد من backup-config.ps1
$cfg = Join-Path $PSScriptRoot 'backup-config.ps1'
if (Test-Path $cfg) { . $cfg }
if (-not $DbHost)     { $DbHost     = $env:MYSQL_HOST; if (-not $DbHost) { $DbHost = $env:MYSQLHOST }; if (-not $DbHost) { $DbHost = 'localhost' } }
if (-not $DbPort)     { $DbPort     = $env:MYSQL_PORT; if (-not $DbPort) { $DbPort = $env:MYSQLPORT }; if (-not $DbPort) { $DbPort = '3306' } }
if (-not $DbName)     { $DbName     = $env:MYSQLDATABASE; if (-not $DbName) { $DbName = $env:MYSQL_DATABASE }; if (-not $DbName) { $DbName = 'shaab_db' } }
if (-not $DbUser)     { $DbUser     = $env:MYSQLUSER; if (-not $DbUser) { $DbUser = $env:MYSQL_USER }; if (-not $DbUser) { $DbUser = 'root' } }
if (-not $DbPassword) { $DbPassword = $env:MYSQLPASSWORD; if (-not $DbPassword) { $DbPassword = $env:MYSQL_PASSWORD } }
if ($MysqlBinDir) { $Mysql = Join-Path $MysqlBinDir 'mysql.exe' } else { $Mysql = 'mysql' }
# وجهة الوسائط في التطبيق (نفس MediaDir المستخدم في النسخ الاحتياطي)
if (-not $MediaDir) { $MediaDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'media' }
# مصدر المرآة: المعطى صراحةً، وإلا مجلد media بجوار ملف الـ zip
if (-not $MediaSource) { $MediaSource = Join-Path (Split-Path $ZipPath -Parent) 'media' }

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

    # ── استعادة مجلد الوسائط (الفيديوهات) من المرآة ──────────────────────
    if (Test-Path $MediaSource) {
        Write-Host "▶ استعادة الوسائط من $MediaSource → $MediaDir ..."
        New-Item -ItemType Directory -Force -Path $MediaDir | Out-Null
        & robocopy "$MediaSource" "$MediaDir" /MIR /Z /R:1 /W:2 /NFL /NDL /NP /NJH /NJS | Out-Null
        if ($LASTEXITCODE -ge 8) { Write-Warning "robocopy وسائط رمز $LASTEXITCODE — راجع المجلد يدوياً" }
        else { Write-Host "✓ استُعيدت الوسائط." -ForegroundColor Green }
        $global:LASTEXITCODE = 0
    } else {
        Write-Host "ℹ لا توجد مرآة وسائط في $MediaSource — تخطّي الفيديوهات." -ForegroundColor DarkGray
    }

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
