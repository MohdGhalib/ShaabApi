using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using ShaabApi.Controllers;
using ShaabApi.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Railway يضبط PORT تلقائياً
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// CORS — السماح للنطاقات المعروفة فقط
var allowedOrigins = (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")
                   ?? "https://shaabapi-shaabapi.up.railway.app")
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

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
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

    var row = await db.Storage.FindAsync("Shaab_Employees_DB");
    List<EmpRecord>? emps = null;
    if (row != null)
        try { emps = JsonSerializer.Deserialize<List<EmpRecord>>(row.StoreValue ?? ""); } catch { }

    var emp0799 = emps?.FirstOrDefault(e => e.EmpId == "0799");
    bool needSeed = emps == null || emp0799 == null || string.IsNullOrEmpty(emp0799.PasswordHash);

    if (needSeed)
    {
        var salt0799 = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower();
        using var kdf = new Rfc2898DeriveBytes(
            Encoding.UTF8.GetBytes("0799"),
            Encoding.UTF8.GetBytes(salt0799),
            100_000,
            HashAlgorithmName.SHA256);
        var hash0799 = "pbkdf2:" + Convert.ToHexString(kdf.GetBytes(32)).ToLower();

        var freshEmps = new List<EmpRecord>
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
            new() { EmpId = "0799", Name = "مدير الكول سنتر", Title = "مدير الكول سنتر",
                    Salt = salt0799,
                    PasswordHash = hash0799 },
        };

        if (row == null)
        {
            db.Storage.Add(new ShaabApi.Models.StorageEntry
            {
                StoreKey   = "Shaab_Employees_DB",
                StoreValue = JsonSerializer.Serialize(freshEmps),
                UpdatedAt  = DateTime.UtcNow
            });
        }
        else
        {
            row.StoreValue = JsonSerializer.Serialize(freshEmps);
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
    RequestPath  = ""
});

// توجيه الصفحة الرئيسية
app.MapGet("/", async context =>
{
    context.Response.ContentType = "text/html; charset=utf-8";
    await context.Response.SendFileAsync(
        Path.Combine(app.Environment.ContentRootPath, "index.html"));
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
