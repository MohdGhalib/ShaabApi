import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

class ApiService {
  static const _tokenKey = '_shaab_token';

  // ── حفظ / قراءة التوكن ──────────────────────────────────────────────
  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  // ── تسجيل الدخول برقم الموظف ────────────────────────────────────────
  static Future<LoginResult> login(String empId) async {
    try {
      final res = await http
          .post(
            Uri.parse('$kBaseUrl/api/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'password': empId}),
          )
          .timeout(const Duration(seconds: 15));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        await saveToken(data['token'] as String);
        return LoginResult.success(
          token:   data['token'] as String,
          name:    data['name']  as String,
          title:   data['title'] as String,
          role:    data['role']  as String,
          isAdmin: data['isAdmin'] as bool,
        );
      } else if (res.statusCode == 429) {
        final d = jsonDecode(res.body);
        return LoginResult.error(d['error'] ?? 'محاولات كثيرة، انتظر قليلاً');
      } else {
        return LoginResult.error('رقم الموظف غير صحيح');
      }
    } catch (_) {
      return LoginResult.error('تعذّر الاتصال بالسيرفر');
    }
  }

  // ── قراءة قاعدة البيانات الرئيسية ───────────────────────────────────
  static Future<Map<String, dynamic>?> fetchMasterDb(String token) async {
    try {
      final res = await http
          .get(
            Uri.parse('$kBaseUrl/api/storage?keys=Shaab_Master_DB'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 15));

      if (res.statusCode == 200) {
        final outer = jsonDecode(res.body) as Map<String, dynamic>;
        final raw   = outer['Shaab_Master_DB'] as String?;
        if (raw == null || raw.isEmpty) {
          return {'montasiat': [], 'inquiries': [], 'complaints': []};
        }
        return jsonDecode(raw) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  // ── حفظ قاعدة البيانات الرئيسية ─────────────────────────────────────
  static Future<bool> saveMasterDb(
      String token, Map<String, dynamic> db) async {
    try {
      final res = await http
          .post(
            Uri.parse('$kBaseUrl/api/storage'),
            headers: {
              'Content-Type':  'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'key':   'Shaab_Master_DB',
              'value': jsonEncode(db),
            }),
          )
          .timeout(const Duration(seconds: 20));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

// ── نموذج نتيجة الدخول ──────────────────────────────────────────────────
class LoginResult {
  final bool    ok;
  final String? errorMsg;
  final String  token;
  final String  name;
  final String  title;
  final String  role;
  final bool    isAdmin;

  const LoginResult._({
    required this.ok,
    this.errorMsg,
    this.token   = '',
    this.name    = '',
    this.title   = '',
    this.role    = '',
    this.isAdmin = false,
  });

  factory LoginResult.success({
    required String token,
    required String name,
    required String title,
    required String role,
    required bool   isAdmin,
  }) => LoginResult._(
        ok: true, token: token, name: name,
        title: title, role: role, isAdmin: isAdmin,
      );

  factory LoginResult.error(String msg) =>
      LoginResult._(ok: false, errorMsg: msg);
}
