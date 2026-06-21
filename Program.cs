using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using ShaabApi.Controllers;
using ShaabApi.Data;
using ShaabApi.Services;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Railway يضبط PORT تلقائياً
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// CORS — السماح للنطاقات المعروفة فقط
// السيرفر الداخلي: اضبط ALLOWED_ORIGINS لعنوان الموقع (عدة عناوين مفصولة بفواصل).
// الافتراضي محلي فقط — لا يُسمح بأي نطاق خارجي ما لم يُضبط صراحةً.
var allowedOrigins = (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")
                   ?? "http://localhost:8080")
                   .Split(',', StringSplitOptions.RemoveEmptyEntries);
builder.Services.AddCors(options => options.AddPolicy("Default", policy =>
    policy.WithOrigins(allowedOrigins)
          .AllowAnyHeader()
          .AllowAnyMethod()));


// حد حجم الطلبات على مستوى السيرفر (10 MB)
builder.WebHost.ConfigureKestrel(o =>
    o.Limits.MaxRequestBodySize = 10 * 1024 * 1024);

// قاعدة البيانات MySQL
// دعم متغيرات Railway
var mysqlHost = Environment.GetEnvironmentVariable("MYSQL_HOST")
             ?? Environment.GetEnvironmentVariable("MYSQLHOST");
var connectionString = mysqlHost != null
    ? $"Server={mysqlHost};" +
      $"Port={Environment.GetEnvironmentVariable("MYSQL_PORT") ?? Environment.GetEnvironmentVariable("MYSQLPORT") ?? "3306"};" +
      $"Database={Environment.GetEnvironmentVariable("MYSQLDATABASE") ?? Environment.GetEnvironmentVariable("MYSQL_DATABASE") ?? "railway"};" +
      $"User={Environment.GetEnvironmentVariable("MYSQLUSER") ?? Environment.GetEnvironmentVariable("MYSQL_USER")};" +
      $"Password={Environment.GetEnvironmentVariable("MYSQLPASSWORD") ?? Environment.GetEnvironmentVariable("MYSQL_PASSWORD")};" +
      "CharSet=utf8mb4;"
    : builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<FcmService>();
builder.Services.AddScoped<PerRecordSyncService>();
builder.Services.AddScoped<EmployeeSyncService>();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // منع تحويل "role" إلى ClaimTypes.Role
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Issuer"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// ── بذار بيانات الموظفين عند الحاجة ──
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();

    // ── Migration: إضافة عمود version لجدول storage إن لم يكن موجوداً ──
    // المعمار الجديد يستخدم Optimistic Concurrency لمنع طمس البيانات
    try
    {
        await db.Database.ExecuteSqlRawAsync(
            "ALTER TABLE storage ADD COLUMN version BIGINT NOT NULL DEFAULT 0"
        );
        Console.WriteLine("[startup] ✓ Added version column to storage table");
    }
    catch (Exception ex)
    {
        // العمود موجود مسبقاً — لا مشكلة
        if (ex.Message.Contains("Duplicate column") || ex.Message.Contains("already exists"))
            Console.WriteLine("[startup] ℹ version column already exists");
        else
            Console.WriteLine($"[startup] ⚠ ALTER TABLE failed: {ex.Message}");
    }

    // ── Phase 1 (Migration #11): إنشاء جداول السجلات المنفصلة ──
    // إضافية فقط — لا تأثير على البيانات أو السلوك. Frontend لا يقرأ منها بعد.
    var _phase1Tables = new (string name, string sql)[]
    {
        ("inquiries", @"CREATE TABLE IF NOT EXISTS inquiries (
            id BIGINT PRIMARY KEY,
            seq INT NULL,
            city VARCHAR(100) NULL,
            branch VARCHAR(100) NULL,
            phone VARCHAR(30) NULL,
            type VARCHAR(50) NULL,
            notes TEXT NULL,
            item_name VARCHAR(200) NULL,
            offer_name VARCHAR(200) NULL,
            quality_photo LONGTEXT NULL,
            time VARCHAR(50) NULL,
            iso VARCHAR(50) NULL,
            added_by VARCHAR(100) NULL,
            data JSON NULL,
            version BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_inq_branch (branch),
            INDEX idx_inq_iso (iso),
            INDEX idx_inq_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"),

        ("montasiat", @"CREATE TABLE IF NOT EXISTS montasiat (
            id BIGINT PRIMARY KEY,
            serial VARCHAR(30) NULL,
            branch VARCHAR(100) NULL,
            type VARCHAR(50) NULL,
            status VARCHAR(50) NULL,
            time VARCHAR(50) NULL,
            iso VARCHAR(50) NULL,
            added_by VARCHAR(100) NULL,
            data JSON NULL,
            version BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mnt_branch (branch),
            INDEX idx_mnt_iso (iso),
            INDEX idx_mnt_type (type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"),

        ("complaints", @"CREATE TABLE IF NOT EXISTS complaints (
            id BIGINT PRIMARY KEY,
            branch VARCHAR(100) NULL,
            notes TEXT NULL,
            time VARCHAR(50) NULL,
            iso VARCHAR(50) NULL,
            file LONGTEXT NULL,
            added_by VARCHAR(100) NULL,
            data JSON NULL,
            version BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cmp_branch (branch),
            INDEX idx_cmp_iso (iso)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"),

        // ── Migration #11 (image off-loading): binary files store ──
        // Images/invoices live here as MEDIUMBLOB; records keep only /api/files/{id}.
        ("files", @"CREATE TABLE IF NOT EXISTS files (
            id VARCHAR(34) PRIMARY KEY,
            mime VARCHAR(100) NULL,
            data MEDIUMBLOB NOT NULL,
            size_bytes INT NOT NULL DEFAULT 0,
            ref_type VARCHAR(30) NULL,
            ref_id VARCHAR(40) NULL,
            created_by VARCHAR(100) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_files_ref (ref_type, ref_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"),

        // ── audit log in its own table (off the Master_DB blob) → months of retention ──
        // ── shadow employees table (synced from Shaab_Employees_DB; auth still uses blob) ──
        ("employees", @"CREATE TABLE IF NOT EXISTS employees (
            emp_id VARCHAR(20) PRIMARY KEY,
            name VARCHAR(100) NULL,
            title VARCHAR(100) NULL,
            salt VARCHAR(64) NULL,
            password_hash VARCHAR(200) NULL,
            data JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"),

        ("audit_log", @"CREATE TABLE IF NOT EXISTS audit_log (
            id VARCHAR(80) PRIMARY KEY,
            action VARCHAR(50) NULL,
            entity VARCHAR(200) NULL,
            summary TEXT NULL,
            by_name VARCHAR(100) NULL,
            emp_id VARCHAR(20) NULL,
            role VARCHAR(40) NULL,
            ref_type VARCHAR(30) NULL,
            ref_id VARCHAR(40) NULL,
            time VARCHAR(50) NULL,
            iso VARCHAR(50) NULL,
            ts BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_ts (ts),
            INDEX idx_audit_emp (emp_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"),

        // -- internal messages in their own table (off the Master_DB blob) --
        // Append + read/delete flag updates; full original object kept in `data` JSON.
        ("messages", @"CREATE TABLE IF NOT EXISTS messages (
            id BIGINT PRIMARY KEY,
            from_name VARCHAR(100) NULL,
            to_name VARCHAR(100) NULL,
            text TEXT NULL,
            ts BIGINT NOT NULL DEFAULT 0,
            read_by_me TINYINT(1) NOT NULL DEFAULT 0,
            deleted TINYINT(1) NOT NULL DEFAULT 0,
            is_intervention TINYINT(1) NOT NULL DEFAULT 0,
            data JSON NULL,
            version BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_msg_ts (ts),
            INDEX idx_msg_to (to_name),
            INDEX idx_msg_from (from_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"),

        // -- regional-managers notes (ملاحظات مدراء مناطق) in their own table --
        ("manager_notes", @"CREATE TABLE IF NOT EXISTS manager_notes (
            id BIGINT PRIMARY KEY,
            branch VARCHAR(100) NULL,
            note_date VARCHAR(30) NULL,
            notified_person VARCHAR(150) NULL,
            text TEXT NULL,
            closed TINYINT(1) NOT NULL DEFAULT 0,
            close_note TEXT NULL,
            closed_by VARCHAR(100) NULL,
            closed_at BIGINT NOT NULL DEFAULT 0,
            added_by VARCHAR(100) NULL,
            ts BIGINT NOT NULL DEFAULT 0,
            updated_ts BIGINT NOT NULL DEFAULT 0,
            deleted TINYINT(1) NOT NULL DEFAULT 0,
            data JSON NULL,
            version BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mnote_ts (ts),
            INDEX idx_mnote_branch (branch),
            INDEX idx_mnote_closed (closed)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;")
    };

    foreach (var (tableName, createSql) in _phase1Tables)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(createSql);
            Console.WriteLine($"[startup] ✓ Per-record table ready: {tableName}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[startup] ⚠ CREATE TABLE {tableName} failed: {ex.Message}");
        }
    }

    // ── (2026-06-12) add manager_notes.updated_ts for last-write-wins merge (edit / reopen) ──
    //    MySQL has no ADD COLUMN IF NOT EXISTS, so probe information_schema first (idempotent).
    try
    {
        var hasUpdatedTs = (await db.Database
            .SqlQueryRaw<long>(
                "SELECT COUNT(*) AS Value FROM information_schema.columns " +
                "WHERE table_schema = DATABASE() AND table_name = 'manager_notes' " +
                "AND column_name = 'updated_ts'")
            .ToListAsync()).FirstOrDefault();
        if (hasUpdatedTs == 0)
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE manager_notes ADD COLUMN updated_ts BIGINT NOT NULL DEFAULT 0");
            Console.WriteLine("[startup] ✓ Added manager_notes.updated_ts column");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[startup] ⚠ ALTER manager_notes.updated_ts failed: {ex.Message}");
    }

    // ── retention: purge audit_log entries older than 6 months (180 days) ──
    try
    {
        var auditCutoff = DateTimeOffset.UtcNow.AddDays(-180).ToUnixTimeMilliseconds();
        var purged = await db.Database.ExecuteSqlRawAsync(
            "DELETE FROM audit_log WHERE ts > 0 AND ts < {0}", auditCutoff);
        if (purged > 0) Console.WriteLine($"[startup] ✓ Purged {purged} audit_log entries older than 180 days");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[startup] ⚠ audit_log purge failed: {ex.Message}");
    }

    // ── Phase 4a fix: serial column INT → VARCHAR(30) to match JSON blob semantics ──
    // Idempotent: if the column is already VARCHAR, MySQL no-ops the MODIFY.
    try
    {
        await db.Database.ExecuteSqlRawAsync(
            "ALTER TABLE montasiat MODIFY COLUMN serial VARCHAR(30) NULL"
        );
        Console.WriteLine("[startup] ✓ montasiat.serial column ensured as VARCHAR(30)");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[startup] ⚠ ALTER montasiat.serial failed: {ex.Message}");
    }

    // ── 🔒 (2026-06-10) UNIQUE index on montasiat.serial — stops duplicate reference
    //    numbers (e.g. 261963). MySQL has no CREATE UNIQUE INDEX IF NOT EXISTS, so we
    //    probe information_schema first. If duplicates still exist the CREATE fails and
    //    we log a hint to run POST /api/admin/dedupe-montasiat-serials?apply=true, which
    //    renumbers the newer duplicates and then builds this index.
    try
    {
        var idxCount = (await db.Database
            .SqlQueryRaw<long>(
                "SELECT COUNT(*) AS Value FROM information_schema.statistics " +
                "WHERE table_schema = DATABASE() AND table_name = 'montasiat' " +
                "AND index_name = 'ux_montasiat_serial'")
            .ToListAsync()).FirstOrDefault();

        if (idxCount == 0)
        {
            await db.Database.ExecuteSqlRawAsync(
                "CREATE UNIQUE INDEX ux_montasiat_serial ON montasiat (serial)");
            Console.WriteLine("[startup] ✓ ux_montasiat_serial unique index created");
        }
        else
        {
            Console.WriteLine("[startup] ✓ ux_montasiat_serial unique index already present");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[startup] ⚠ ux_montasiat_serial NOT created (likely existing duplicate serials): {ex.Message}");
        Console.WriteLine("[startup] → run POST /api/admin/dedupe-montasiat-serials?apply=true to fix duplicates, then redeploy.");
    }

    var row = await db.Storage.FindAsync("Shaab_Employees_DB");
    List<EmpRecord>? emps = null;
    if (row != null)
        try { emps = JsonSerializer.Deserialize<List<EmpRecord>>(row.StoreValue ?? ""); } catch { }

    // تحقق إذا كان الموظف 0799 موجوداً وكلمة مروره صحيحة
    var emp0799 = emps?.FirstOrDefault(e => e.EmpId == "0799");
    bool passwordOk = false;
    if (emp0799 != null && !string.IsNullOrEmpty(emp0799.PasswordHash))
    {
        var salt = emp0799.Salt ?? "";
        var hash = emp0799.PasswordHash;
        if (hash.StartsWith("pbkdf2:"))
        {
            using var testKdf = new Rfc2898DeriveBytes(
                Encoding.UTF8.GetBytes("0799"),
                Encoding.UTF8.GetBytes(salt),
                100_000,
                HashAlgorithmName.SHA256);
            passwordOk = ("pbkdf2:" + Convert.ToHexString(testKdf.GetBytes(32)).ToLower()) == hash;
        }
        else
        {
            var sha = System.Security.Cryptography.SHA256.HashData(
                Encoding.UTF8.GetBytes(salt + "0799"));
            passwordOk = Convert.ToHexString(sha).ToLower() == hash;
        }
    }

    if (emps == null || emp0799 == null || !passwordOk)
    {
        var salt0799 = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower();
        using var kdf = new Rfc2898DeriveBytes(
            Encoding.UTF8.GetBytes("0799"),
            Encoding.UTF8.GetBytes(salt0799),
            100_000,
            HashAlgorithmName.SHA256);
        var hash0799 = "pbkdf2:" + Convert.ToHexString(kdf.GetBytes(32)).ToLower();

        // حافظ على بقية الموظفين إن وُجدوا، فقط أضف/صحح 0799
        if (emps == null)
        {
            emps = new List<EmpRecord>
            {
                new() { EmpId = "9999", Name = "احمد النجار",   Title = "موظف ميديا",
                        Salt = "7f7c276b408d096fa5ec9aa00d3b6b0f",
                        PasswordHash = "7cc7d52363370fd361fa4dc85f2ace9d1836f15debac19175ac0530cea3916e7" },
                new() { EmpId = "1111", Name = "محمد غالب",     Title = "مدير قسم السيطرة",
                        Salt = "c1bb0da1d7e1fa1a5ff49c403c745833",
                        PasswordHash = "pbkdf2:fd24c2b4032b150d543178593768749131286e32d6eba101a9298f1f2ce9145d" },
                new() { EmpId = "0000", Name = "مسؤول",          Title = "موظف كول سنتر",
                        Salt = "b3bda546ad9d50f8882b47b6c1dae23a",
                        PasswordHash = "e468b63814f55f34c958dd7b3450ca64f472247abc53514b5e4580ff7bef1912" },
            };
        }

        emps.RemoveAll(e => e.EmpId == "0799");
        emps.Add(new EmpRecord
        {
            EmpId        = "0799",
            Name         = "مدير الكول سنتر",
            Title        = "مدير الكول سنتر",
            Salt         = salt0799,
            PasswordHash = hash0799
        });

        if (row == null)
        {
            db.Storage.Add(new ShaabApi.Models.StorageEntry
            {
                StoreKey   = "Shaab_Employees_DB",
                StoreValue = JsonSerializer.Serialize(emps),
                UpdatedAt  = DateTime.UtcNow
            });
        }
        else
        {
            row.StoreValue = JsonSerializer.Serialize(emps);
            row.UpdatedAt  = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
    }
}

app.UseCors("Default");

// ── رؤوس الأمان ──
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Frame-Options"]        = "DENY";
    h["X-Content-Type-Options"] = "nosniff";
    h["Referrer-Policy"]        = "strict-origin-when-cross-origin";
    h["Permissions-Policy"]     = "camera=(), microphone=(), geolocation=()";
    h["X-XSS-Protection"]       = "0";
    h["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "media-src 'self'; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none';";
    if (!app.Environment.IsDevelopment())
        h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    await next();
});

// تقديم ملفات الموقع الثابتة
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(app.Environment.ContentRootPath),
    RequestPath  = "",
    OnPrepareResponse = ctx =>
    {
        // 🛡️ HTML files: لا تُخزَّن في cache. أي تحديث في الـ ?v= يصل فوراً.
        // باقي الأصول (JS/CSS/images): تُخزَّن سنة كاملة. التحديث يحدث عبر ?v= فقط.
        var name = ctx.File.Name;
        if (name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
            ctx.Context.Response.Headers["Pragma"] = "no-cache";
            ctx.Context.Response.Headers["Expires"] = "0";
        }
        else
        {
            ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000";
        }
    }
});

// توجيه الصفحة الرئيسية
app.MapGet("/", async context =>
{
    context.Response.ContentType = "text/html; charset=utf-8";
    // 🛡️ منع تخزين index.html في cache — يضمن أن كل تحديث ?v= يصل لجميع المتصفحات فوراً
    context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
    context.Response.Headers["Pragma"] = "no-cache";
    context.Response.Headers["Expires"] = "0";
    await context.Response.SendFileAsync(
        Path.Combine(app.Environment.ContentRootPath, "index.html"));
});

// لوحة تحكم التطبيق — رابط نظيف بدون امتداد
app.MapGet("/admin", async context =>
{
    context.Response.ContentType = "text/html; charset=utf-8";
    // 🛡️ منع تخزين admin.html في cache — نفس المنطق
    context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
    context.Response.Headers["Pragma"] = "no-cache";
    context.Response.Headers["Expires"] = "0";
    await context.Response.SendFileAsync(
        Path.Combine(app.Environment.ContentRootPath, "admin.html"));
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
