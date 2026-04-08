using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using ShaabApi.Data;
using System.Text.Json;

namespace ShaabApi.Services;

/// خدمة إرسال إشعارات Firebase Cloud Messaging
public class FcmService
{
    private readonly AppDbContext _db;
    private static bool _initialized = false;
    private static readonly object _lock = new();

    public FcmService(AppDbContext db)
    {
        _db = db;
        EnsureInitialized();
    }

    private static void EnsureInitialized()
    {
        if (_initialized) return;
        lock (_lock)
        {
            if (_initialized) return;
            var json = Environment.GetEnvironmentVariable("FIREBASE_SERVICE_ACCOUNT_JSON");
            if (string.IsNullOrEmpty(json)) return;
            try
            {
                if (FirebaseApp.DefaultInstance == null)
                {
                    FirebaseApp.Create(new AppOptions
                    {
                        Credential = GoogleCredential.FromJson(json)
                    });
                }
                _initialized = true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FCM] Init failed: {ex.Message}");
            }
        }
    }

    /// إرسال إشعار لأدوار محددة
    public async Task SendToRoles(string[] roles, string title, string body)
    {
        if (!_initialized) return;
        var tokens = await GetTokensForRoles(roles);
        if (tokens.Count == 0) return;
        await SendToTokens(tokens, title, body);
    }

    /// إرسال إشعار لموظف محدد بـ empId
    public async Task SendToEmp(string empId, string title, string body)
    {
        if (!_initialized) return;
        var tokens = await GetTokensForEmp(empId);
        if (tokens.Count == 0) return;
        await SendToTokens(tokens, title, body);
    }

    private async Task SendToTokens(List<string> tokens, string title, string body)
    {
        try
        {
            // FCM يسمح بـ 500 token لكل batch
            var batches = tokens.Chunk(500).ToList();
            foreach (var batch in batches)
            {
                var message = new MulticastMessage
                {
                    Tokens       = batch.ToList(),
                    Notification = new Notification { Title = title, Body = body },
                    Android      = new AndroidConfig
                    {
                        Priority     = Priority.High,
                        Notification = new AndroidNotification
                        {
                            ChannelId  = "shaab_main",
                            Sound      = "melodic_notification",
                            ClickAction = "FLUTTER_NOTIFICATION_CLICK",
                        }
                    }
                };
                var result = await FirebaseMessaging.DefaultInstance.SendEachForMulticastAsync(message);
                Console.WriteLine($"[FCM] Sent {result.SuccessCount}/{batch.Length} notifications");

                // حذف التوكنات غير الصالحة
                var invalid = new List<string>();
                for (int i = 0; i < result.Responses.Count; i++)
                {
                    if (!result.Responses[i].IsSuccess)
                    {
                        var errCode = result.Responses[i].Exception?.MessagingErrorCode;
                        if (errCode == MessagingErrorCode.Unregistered ||
                            errCode == MessagingErrorCode.InvalidArgument)
                        {
                            invalid.Add(batch[i]);
                        }
                    }
                }
                if (invalid.Count > 0) await RemoveInvalidTokens(invalid);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FCM] SendToTokens error: {ex.Message}");
        }
    }

    private async Task<List<string>> GetTokensForRoles(string[] roles)
    {
        var all = await GetAllTokens();
        return all
            .Where(t => roles.Contains(t.Role))
            .Select(t => t.FcmToken)
            .Distinct()
            .ToList();
    }

    private async Task<List<string>> GetTokensForEmp(string empId)
    {
        var all = await GetAllTokens();
        return all
            .Where(t => t.EmpId == empId)
            .Select(t => t.FcmToken)
            .Distinct()
            .ToList();
    }

    private async Task<List<FcmTokenRecord>> GetAllTokens()
    {
        var row = await _db.Storage.FindAsync("Shaab_FCM_Tokens");
        if (row == null || string.IsNullOrEmpty(row.StoreValue)) return [];
        try { return JsonSerializer.Deserialize<List<FcmTokenRecord>>(row.StoreValue) ?? []; }
        catch { return []; }
    }

    private async Task RemoveInvalidTokens(List<string> invalidTokens)
    {
        var row = await _db.Storage.FindAsync("Shaab_FCM_Tokens");
        if (row == null) return;
        try
        {
            var list = JsonSerializer.Deserialize<List<FcmTokenRecord>>(row.StoreValue ?? "[]") ?? [];
            list = list.Where(t => !invalidTokens.Contains(t.FcmToken)).ToList();
            row.StoreValue = JsonSerializer.Serialize(list);
            row.UpdatedAt  = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch { }
    }
}

public record FcmTokenRecord(string EmpId, string Role, string FcmToken);
