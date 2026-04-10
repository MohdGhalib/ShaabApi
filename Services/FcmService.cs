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

    public const string CredsKey = "Shaab_Firebase_Creds";

    public FcmService(AppDbContext db)
    {
        _db = db;
    }

    // يُستدعى في أول request لمحاولة التهيئة من DB أو env var
    public async Task EnsureInitializedAsync()
    {
        if (_initialized) return;

        string? json = null;

        // 1) env var (raw)
        var raw = Environment.GetEnvironmentVariable("FIREBASE_SERVICE_ACCOUNT_JSON");
        if (!string.IsNullOrEmpty(raw)) { json = raw; Console.WriteLine("[FCM] Using env var (raw)"); }

        // 2) env var (base64)
        if (json == null)
        {
            var b64 = Environment.GetEnvironmentVariable("FIREBASE_SERVICE_ACCOUNT_JSON_B64");
            if (!string.IsNullOrEmpty(b64))
            {
                try { json = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(b64)); Console.WriteLine("[FCM] Using env var (base64)"); }
                catch (Exception ex) { Console.WriteLine($"[FCM] base64 decode error: {ex.Message}"); }
            }
        }

        // 3) قاعدة البيانات
        if (json == null)
        {
            try
            {
                var row = await _db.Storage.FindAsync(CredsKey);
                if (row != null && !string.IsNullOrEmpty(row.StoreValue))
                {
                    json = row.StoreValue;
                    Console.WriteLine("[FCM] Using credentials from database");
                }
            }
            catch (Exception ex) { Console.WriteLine($"[FCM] DB read error: {ex.Message}"); }
        }

        if (json == null)
        {
            Console.WriteLine("[FCM] No credentials found — notifications disabled");
            return;
        }

        lock (_lock)
        {
            if (_initialized) return;
            try
            {
                if (FirebaseApp.DefaultInstance == null)
                    FirebaseApp.Create(new AppOptions { Credential = GoogleCredential.FromJson(json) });
                _initialized = true;
                Console.WriteLine("[FCM] Firebase initialized successfully");
            }
            catch (Exception ex) { Console.WriteLine($"[FCM] Init failed: {ex.Message}"); }
        }
    }

    public bool IsReady => _initialized;

    // ── قراءة كل الـ tokens من DB ─────────────────────────────────────────
    public async Task<List<FcmTokenRecord>> GetAllTokens()
    {
        var row = await _db.Storage.FindAsync("Shaab_FCM_Tokens");
        if (row == null || string.IsNullOrEmpty(row.StoreValue)) return [];
        try { return JsonSerializer.Deserialize<List<FcmTokenRecord>>(row.StoreValue) ?? []; }
        catch { return []; }
    }

    // ── إرسال إشعار حسب الدور ─────────────────────────────────────────────
    public static async Task SendToRolesStatic(
        List<FcmTokenRecord> allTokens,
        string[] roles,
        string title,
        string body,
        Dictionary<string, string>? data = null)
    {
        if (!_initialized) return;
        var tokens = allTokens
            .Where(t => roles.Contains(t.Role))
            .Select(t => t.FcmToken)
            .Distinct()
            .ToList();
        if (tokens.Count == 0) return;
        await SendBatch(tokens, title, body, data);
    }

    // ── إرسال إشعار لقائمة tokens مباشرة ────────────────────────────────
    public static async Task SendToTokensStatic(
        List<string> tokens,
        string title,
        string body,
        Dictionary<string, string>? data = null)
    {
        if (!_initialized || tokens.Count == 0) return;
        await SendBatch(tokens, title, body, data);
    }

    // ── إرسال إشعار لموظفين محددين بـ empId ──────────────────────────────
    public static async Task SendToEmpIdsStatic(
        List<FcmTokenRecord> allTokens,
        List<string> empIds,
        string title,
        string body,
        Dictionary<string, string>? data = null)
    {
        if (!_initialized) return;
        var tokens = allTokens
            .Where(t => empIds.Contains(t.EmpId))
            .Select(t => t.FcmToken)
            .Distinct()
            .ToList();
        if (tokens.Count == 0) return;
        await SendBatch(tokens, title, body, data);
    }

    private static async Task SendBatch(List<string> tokens, string title, string body,
        Dictionary<string, string>? data = null)
    {
        try
        {
            foreach (var batch in tokens.Chunk(500))
            {
                // data-only message — Flutter يتحكم بالعرض والصوت بالكامل
                var msgData = new Dictionary<string, string>(data ?? [])
                {
                    ["title"] = title,
                    ["body"]  = body,
                };
                var msg = new MulticastMessage
                {
                    Tokens  = batch.ToList(),
                    Data    = msgData,
                    Android = new AndroidConfig { Priority = Priority.High }
                };
                var result = await FirebaseMessaging.DefaultInstance.SendEachForMulticastAsync(msg);
                Console.WriteLine($"[FCM] Sent {result.SuccessCount}/{batch.Length} — title: {title}");
                for (int i = 0; i < result.Responses.Count; i++)
                    if (!result.Responses[i].IsSuccess)
                        Console.WriteLine($"[FCM] Token[{i}] error: {result.Responses[i].Exception?.Message}");
            }
        }
        catch (Exception ex) { Console.WriteLine($"[FCM] SendBatch error: {ex.Message}"); }
    }

    // ── حذف tokens غير صالحة ──────────────────────────────────────────────
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
