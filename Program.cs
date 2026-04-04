using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using ShaabApi.Data;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Railway يضبط PORT تلقائياً
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");


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

// ── رؤوس الأمان ──
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Frame-Options"]           = "DENY";
    h["X-Content-Type-Options"]    = "nosniff";
    h["Referrer-Policy"]           = "strict-origin-when-cross-origin";
    h["Permissions-Policy"]        = "camera=(), microphone=(), geolocation=()";
    h["X-XSS-Protection"]          = "0"; // المتصفحات الحديثة لا تحتاجه؛ القيمة 0 تمنع سلوكه الخاطئ
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
