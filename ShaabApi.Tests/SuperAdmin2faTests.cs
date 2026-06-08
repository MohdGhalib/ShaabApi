using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OtpNet;
using ShaabApi.Controllers;
using ShaabApi.Data;
using Xunit;

namespace ShaabApi.Tests;

/// <summary>
/// Protects the super-admin TOTP 2FA flow: setup (password-gated) → verify a real
/// authenticator code → reject a wrong code and a wrong setup password.
/// </summary>
public class SuperAdmin2faTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly IConfiguration _config;

    public SuperAdmin2faTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        _options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;
        using var ctx = new AppDbContext(_options);
        ctx.Database.EnsureCreated();
        _config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["SuperAdminPassword"] = "pw-test-123" })
            .Build();
    }

    public void Dispose() => _conn.Dispose();

    private AppDbContext NewCtx() => new AppDbContext(_options);

    private SuperAdmin2faController NewCtrl()
        => new SuperAdmin2faController(NewCtx(), _config)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

    private static T Prop<T>(object res, string name)
    {
        var val = Assert.IsType<OkObjectResult>(res).Value!;
        return (T)val.GetType().GetProperty(name)!.GetValue(val)!;
    }

    [Fact]
    public async Task Setup_ThenVerify_RealCode_Succeeds()
    {
        var setup = await NewCtrl().Setup(new SuperAdmin2faController.SetupReq("pw-test-123", null));
        var secret = Prop<string>(setup, "secret");
        Assert.False(string.IsNullOrEmpty(secret));

        var code = new Totp(Base32Encoding.ToBytes(secret)).ComputeTotp();
        var verify = await NewCtrl().Verify(new SuperAdmin2faController.VerifyReq(code));
        Assert.True(Prop<bool>(verify, "ok"));
    }

    [Fact]
    public async Task Verify_WrongCode_Fails()
    {
        await NewCtrl().Setup(new SuperAdmin2faController.SetupReq("pw-test-123", null));
        var verify = await NewCtrl().Verify(new SuperAdmin2faController.VerifyReq("000000"));
        Assert.False(Prop<bool>(verify, "ok"));
    }

    [Fact]
    public async Task Setup_WrongPassword_Unauthorized()
    {
        var setup = await NewCtrl().Setup(new SuperAdmin2faController.SetupReq("wrong", null));
        Assert.IsType<UnauthorizedObjectResult>(setup);
    }
}
