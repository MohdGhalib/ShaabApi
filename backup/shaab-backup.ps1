<#
═══════════════════════════════════════════════════════════════════════════
  Shaab DB Backup  —  نسخ احتياطي لقاعدة بيانات MySQL (يشمل جدول الصور)
═══════════════════════════════════════════════════════════════════════════
  • mysqldump متّسق (--single-transaction) + صور ثنائية آمنة (--hex-blob)
    + عربية صحيحة (utf8mb4) + إجراءات/مشغّلات.
  • يضغط الناتج .zip مؤرّخ، يحتفظ بـ N يوماً، يحذف الأقدم.
  • نسخة ثانية "خارج الموقع" اختيارية (قرص/شبكة).
  • يقرأ بيانات الاتصال من نفس متغيّرات بيئة التطبيق (Program.cs) أو من الإعداد أدناه.

  الاستخدام اليدوي:   powershell -ExecutionPolicy Bypass -File shaab-backup.ps1
  الجدولة:           انظر backup/README.md (Task Scheduler)
═══════════════════════════════════════════════════════════════════════════
#>

# ── 1) الإعداد — يُقرأ من backup-config.ps1 (هو الملف الوحيد الذي يعدّله المبرمج) ──
$cfg = Join-Path $PSScriptRoot 'backup-config.ps1'
if (Test-Path $cfg) { . $cfg }

# fallback: لو لم يضبط الإعداد قيمةً، استخدم متغيّرات بيئة التطبيق ثم الافتراضي.
if (-not $DbHost)     { $DbHost     = $env:MYSQL_HOST; if (-not $DbHost) { $DbHost = $env:MYSQLHOST }; if (-not $DbHost) { $DbHost = 'localhost' } }
if (-not $DbPort)     { $DbPort     = $env:MYSQL_PORT; if (-not $DbPort) { $DbPort = $env:MYSQLPORT }; if (-not $DbPort) { $DbPort = '3306' } }
if (-not $DbName)     { $DbName     = $env:MYSQLDATABASE; if (-not $DbName) { $DbName = $env:MYSQL_DATABASE }; if (-not $DbName) { $DbName = 'shaab_db' } }
if (-not $DbUser)     { $DbUser     = $env:MYSQLUSER; if (-not $DbUser) { $DbUser = $env:MYSQL_USER }; if (-not $DbUser) { $DbUser = 'root' } }
if (-not $DbPassword) { $DbPassword = $env:MYSQLPASSWORD; if (-not $DbPassword) { $DbPassword = $env:MYSQL_PASSWORD } }
if (-not $BackupDir)  { $BackupDir  = 'C:\ShaabBackups' }
if (-not $OffsiteDir) { $OffsiteDir = '' }
if (-not $RetentionDays) { $RetentionDays = 30 }

# مسار mysqldump (من المجلد bin إن حُدّد، وإلا من PATH):
if ($MysqlBinDir) { $MysqlDump = Join-Path $MysqlBinDir 'mysqldump.exe' } else { $MysqlDump = 'mysqldump' }

# ── 2) تجهيز ──────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
$stamp   = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$logFile = Join-Path $BackupDir 'backup.log'
function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Write-Output $line
    try { Add-Content -Path $logFile -Value $line -Encoding utf8 } catch {}
}

if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null }

$sqlFile = Join-Path $BackupDir "shaab_db_$stamp.sql"
$zipFile = Join-Path $BackupDir "shaab_db_$stamp.zip"

# ملف إعداد مؤقّت لتمرير كلمة المرور بأمان (لا تظهر في قائمة العمليات)
$cnfFile = Join-Path $env:TEMP "shaab_my_$([guid]::NewGuid().ToString('N')).cnf"
@"
[client]
host=$DbHost
port=$DbPort
user=$DbUser
password=$DbPassword
"@ | Set-Content -Path $cnfFile -Encoding ascii -NoNewline

try {
    Log "▶ بدء النسخ: قاعدة '$DbName' على $DbHost`:$DbPort"

    # ── 3) mysqldump ───────────────────────────────────────────────────────
    # --single-transaction: لقطة متّسقة بلا قفل (InnoDB)
    # --hex-blob: حفظ الصور الثنائية (جدول files) بأمان
    # --default-character-set=utf8mb4: عربية صحيحة
    # --routines --triggers --events: كائنات القاعدة كاملة
    & $MysqlDump "--defaults-extra-file=$cnfFile" `
        --single-transaction --quick --routines --triggers --events `
        --hex-blob --default-character-set=utf8mb4 --add-drop-table `
        --databases $DbName --result-file="$sqlFile" 2>> $logFile

    if ($LASTEXITCODE -ne 0) { throw "mysqldump فشل برمز $LASTEXITCODE — راجع backup.log" }
    if (-not (Test-Path $sqlFile) -or (Get-Item $sqlFile).Length -lt 1024) {
        throw "ملف النسخ فارغ أو صغير جداً — فشل محتمل"
    }
    $sqlMB = [math]::Round((Get-Item $sqlFile).Length / 1MB, 2)
    Log "✓ تم الـ dump: $sqlMB MB"

    # ── 4) ضغط ثم حذف الـ .sql الخام ──────────────────────────────────────
    Compress-Archive -Path $sqlFile -DestinationPath $zipFile -Force
    Remove-Item $sqlFile -Force
    $zipMB = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)
    Log "✓ مضغوط: $(Split-Path $zipFile -Leaf) ($zipMB MB)"

    # ── 5) نسخة خارج الموقع ───────────────────────────────────────────────
    if ($OffsiteDir) {
        try {
            if (-not (Test-Path $OffsiteDir)) { New-Item -ItemType Directory -Force -Path $OffsiteDir | Out-Null }
            Copy-Item $zipFile -Destination $OffsiteDir -Force
            Log "✓ نُسخت خارج الموقع → $OffsiteDir"
        } catch { Log "⚠ فشل النسخ خارج الموقع: $($_.Exception.Message)" }
    }

    # ── 6) تنظيف الأقدم من RetentionDays في المجلدين ──────────────────────
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    foreach ($dir in @($BackupDir, $OffsiteDir)) {
        if (-not $dir -or -not (Test-Path $dir)) { continue }
        $old = Get-ChildItem -Path $dir -Filter 'shaab_db_*.zip' -File |
               Where-Object { $_.LastWriteTime -lt $cutoff }
        foreach ($f in $old) {
            try { Remove-Item $f.FullName -Force; Log "🧹 حُذف القديم: $($f.Name)" } catch {}
        }
    }

    Log "✅ اكتمل النسخ بنجاح."
    exit 0
}
catch {
    Log "❌ فشل النسخ: $($_.Exception.Message)"
    if (Test-Path $sqlFile) { try { Remove-Item $sqlFile -Force } catch {} }
    exit 1
}
finally {
    # احذف ملف كلمة المرور المؤقّت دائماً
    if (Test-Path $cnfFile) { try { Remove-Item $cnfFile -Force } catch {} }
}
