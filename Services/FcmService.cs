using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using ShaabApi.Data;
using System.Text.Json;

namespace ShaabApi.Services;

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
            if (string.IsNullOrEmpty(json))
            {
                Console.WriteLine("[FCM] FIREBASE_SERVICE_ACCOUNT_JSON not set — notifications disabled");
                return;
            }
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
                Console.WriteLine("[FCM] Firebase initialized successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FCM] Init failed: {ex.Message}");
            }
        }
    }

    public bool IsReady => _initialized;

    // ── قراءة كل الـ tokens من DB (في نطاق الـ request) ───────────────────
    public async Task<List<FcmTokenRecord>> GetAllTokens()
    {
        var row = await _db.Storage.FindAsync("Shaab_FCM_Tokens");
        if (row == null || string.IsNullOrEmpty(row.StoreValue)) return [];
        try { return JsonSerializer.Deserialize<List<FcmTokenRecord>>(row.StoreValue) ?? []; }
        catch { return []; }
    }

    // ── إرسال إشعار — STATIC لا يحتاج DB ─────────────────────────────────
    public static async Task SendToRolesStatic(
        List<FcmTokenRecord> allTokens,
        string[] roles,
        string title,
        string body)
    {
        if (!_initialized) return;
        var tokens = allTokens
            .Where(t => roles.Contains(t.Role))
            .Select(t => t.FcmToken)
            .Distinct()
            .ToList();
        if (tokens.Count == 0) return;
        await SendBatch(tokens, title, body);
    }

    private static async Task SendBatch(List<string> tokens, string title, string body)
    {
        try
        {
            foreach (var batch in tokens.Chunk(500))
            {
                var msg = new MulticastMessage
                {
                    Tokens       = batch.ToList(),
                    Notification = new Notification { Title = title, Body = body },
                    Android      = new AndroidConfig
                    {
                        Priority     = Priority.High,
                        Notification = new AndroidNotification
                        {
                            ChannelId   = "shaab_main",
                            Sound       = "melodic_notification",
                            ClickAction = "FLUTTER_NOTIFICATION_CLICK",
                        }
                    }
                };
                var result = await FirebaseMessaging.DefaultInstance.SendEachForMulticastAsync(msg);
                Console.WriteLine($"[FCM] Sent {result.SuccessCount}/{batch.Length} — title: {title}");
                for (int i = 0; i < result.Responses.Count; i++)
                    if (!result.Responses[i].IsSuccess)
                        Console.WriteLine($"[FCM] Token[{i}] error: {result.Responses[i].Exception?.Message}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FCM] SendBatch error: {ex.Message}");
        }
    }

    // ── حذف tokens غير صالحة (يُستدعى ضمن request scope) ──────────────────
    public async Task RemoveInvalidTokens(List<string> invalid)
    {
        var row = await _db.Storage.FindAsync("Shaab_FCM_Tokens");
        if (row == null) return;
        try
        {
            var list = JsonSerializer.Deserialize<List<FcmTokenRecord>>(row.StoreValue ?? "[]") ?? [];
            list = list.Where(t => !invalid.Contains(t.FcmToken)).ToList();
            row.StoreValue = JsonSerializer.Serialize(list);
            row.UpdatedAt  = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch { }
    }
}

public record FcmTokenRecord(string EmpId, string Role, string FcmToken);
