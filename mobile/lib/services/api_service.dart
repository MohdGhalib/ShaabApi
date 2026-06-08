import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

class ApiService {
  static const _tokenKey = '_shaab_token';

  // ── رفع صورة إلى /api/files وإرجاع الرابط (/api/files/{id}) ──────────
  // (Migration #11) بدل تخزين base64 داخل Master_DB. يُرجع null عند الفشل.
  static Future<String?> uploadImageBytes(
      String token, List<int> bytes,
      {String filename = 'photo.jpg', String? refType, String? refId}) async {
    try {
      final req = http.MultipartRequest('POST', Uri.parse('$kBaseUrl/api/files'));
      req.headers['Authorization'] = 'Bearer $token';
      req.files.add(http.MultipartFile.fromBytes(
        'file', bytes,
        filename: filename,
        contentType: MediaType('image', 'jpeg'),
      ));
      if (refType != null) req.fields['refType'] = refType;
      if (refId   != null) req.fields['refId']   = refId;

      final streamed = await req.send().timeout(const Duration(seconds: 30));
      final res = await http.Response.fromStream(streamed);
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        return data['url'] as String?;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

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

  // ── حماية تأخّر الـ replica (read-after-write) ─────────────────────────
  // Railway يوزّع القراءات على نُسخ قد تتأخّر بالتزامن، فالـ GET الفوري بعد كتابة
  // قد يُعيد النسخة القديمة → المنتسية المحذوفة "ترجع" حتى يلحق الـ replica. نحتفظ
  // بالنسخة المحلية لكل سجل عُدِّل لمدة نافذة قصيرة، ونطبّقها فوق ردّ الخادم. يحاكي
  // نافذة _recentlyDispatched في الويب. يغطّي الإنشاء/التحديث/الحذف لكل الأنواع.
  static const int _recentWindowMs = 60000; // 60ث
  static final Map<String, Map<String, _RecentEdit>> _recentEdits = {
    'montasiat': {}, 'inquiries': {}, 'complaints': {},
  };

  static void _rememberEdit(String type, dynamic id, Map<String, dynamic> record) {
    final m = _recentEdits[type];
    if (m == null || id == null) return;
    m[id.toString()] = _RecentEdit(
      record:    Map<String, dynamic>.from(record),
      expiresAt: DateTime.now().millisecondsSinceEpoch + _recentWindowMs,
    );
  }

  static List<dynamic> _applyRecentEdits(String type, List<dynamic> serverList) {
    final m = _recentEdits[type];
    if (m == null || m.isEmpty) return serverList;
    final now = DateTime.now().millisecondsSinceEpoch;
    m.removeWhere((_, e) => e.expiresAt < now); // نظّف المنتهية
    if (m.isEmpty) return serverList;
    final seen = <String>{};
    final out  = <dynamic>[];
    for (final item in serverList) {
      if (item is Map && item['id'] != null) {
        final id = item['id'].toString();
        if (m.containsKey(id)) { out.add(m[id]!.record); seen.add(id); } // المحلي يفوز على الخادم المتأخّر
        else { out.add(item); }
      } else { out.add(item); }
    }
    // أضِف تعديلات حديثة غير موجودة في ردّ الخادم بعد (إنشاء/تحديث لم يتزامن)
    m.forEach((id, e) { if (!seen.contains(id)) out.add(e.record); });
    return out;
  }

  // ── per-record: montasiat / inquiries / complaints (Migration #11) ──
  // قراءة وكتابة كل سجل على حدة بدل دفع Master_DB الكامل (يمنع الدهس + يخفّف الطلبات).
  static Future<List<dynamic>?> _fetchList(String token, String type) async {
    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/$type'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 20));
      if (res.statusCode == 200) {
        return _applyRecentEdits(type, jsonDecode(res.body) as List);
      }
    } catch (_) {}
    return null;
  }

  static Future<List<dynamic>?> fetchMontasiat(String token) => _fetchList(token, 'montasiat');
  static Future<List<dynamic>?> fetchInquiries(String token) => _fetchList(token, 'inquiries');
  static Future<List<dynamic>?> fetchComplaints(String token) => _fetchList(token, 'complaints');

  static Future<bool> _createRecord(
      String token, String type, Map<String, dynamic> record) async {
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/$type'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
        body: jsonEncode(record),
      ).timeout(const Duration(seconds: 20));
      final ok = res.statusCode == 200;
      if (ok) _rememberEdit(type, record['id'], record); // حماية تأخّر الـ replica
      return ok;
    } catch (_) { return false; }
  }

  // PUT يستبدل كل الحقول → نرسل السجل الكامل (المعدَّل في الذاكرة) لا delta.
  static Future<bool> _updateRecord(
      String token, String type, dynamic id, Map<String, dynamic> record) async {
    try {
      final res = await http.put(
        Uri.parse('$kBaseUrl/api/$type/$id'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
        body: jsonEncode(record),
      ).timeout(const Duration(seconds: 20));
      final ok = res.statusCode == 200;
      if (ok) _rememberEdit(type, id, record); // حماية تأخّر الـ replica (يشمل الحذف الناعم)
      return ok;
    } catch (_) { return false; }
  }

  static Future<bool> createMontasia(String token, Map<String, dynamic> r) => _createRecord(token, 'montasiat', r);
  static Future<bool> updateMontasia(String token, dynamic id, Map<String, dynamic> r) => _updateRecord(token, 'montasiat', id, r);
  static Future<bool> updateComplaint(String token, dynamic id, Map<String, dynamic> r) => _updateRecord(token, 'complaints', id, r);

  // قراءة الموظفين عبر GET /api/employees (جدول الظل، بدون أسرار). يعود إلى الـ blob
  // إن فشل/فرغ — أمان حتى قبل اكتمال المزامنة. (الكتابة وتسجيل الدخول يبقيان على الـ blob.)
  static Future<List<Map<String, dynamic>>?> fetchEmployees(String token) async {
    final list = await _fetchList(token, 'employees');
    if (list != null && list.isNotEmpty) return list.cast<Map<String, dynamic>>();
    return fetchEmployeesDb(token);
  }

  // ── قراءة قاعدة بيانات الموظفين ─────────────────────────────────────
  static Future<List<Map<String, dynamic>>?> fetchEmployeesDb(
      String token) async {
    try {
      final res = await http
          .get(
            Uri.parse('$kBaseUrl/api/storage?keys=Shaab_Employees_DB'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 15));
      if (res.statusCode == 200) {
        final outer = jsonDecode(res.body) as Map<String, dynamic>;
        final raw   = outer['Shaab_Employees_DB'] as String?;
        if (raw == null || raw.isEmpty) return [];
        return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return null;
  }

  // ── حفظ قاعدة بيانات الموظفين ────────────────────────────────────────
  static Future<bool> saveEmployeesDb(
      String token, List<Map<String, dynamic>> emps) async {
    try {
      final res = await http
          .post(
            Uri.parse('$kBaseUrl/api/storage'),
            headers: {
              'Content-Type':  'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'key':   'Shaab_Employees_DB',
              'value': jsonEncode(emps),
            }),
          )
          .timeout(const Duration(seconds: 20));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // ── قراءة حالة التطبيق من لوحة التحكم ──────────────────────────────
  static Future<Map<String, dynamic>?> fetchAppControl(String token) async {
    try {
      final res = await http
          .get(
            Uri.parse('$kBaseUrl/api/admin/control'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  // ── تسجيل FCM Token على السيرفر ──────────────────────────────────────
  static Future<void> registerFcmToken(String authToken, String empId, String role, String fcmToken) async {
    try {
      await http.post(
        Uri.parse('$kBaseUrl/api/fcm/register'),
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode({'empId': empId, 'role': role, 'fcmToken': fcmToken}),
      ).timeout(const Duration(seconds: 10));
    } catch (_) {}
  }

  // ── إلغاء تسجيل FCM Token عند تسجيل الخروج ──────────────────────────
  static Future<void> unregisterFcmToken(String authToken) async {
    try {
      await http.post(
        Uri.parse('$kBaseUrl/api/fcm/unregister'),
        headers: {'Authorization': 'Bearer $authToken'},
      ).timeout(const Duration(seconds: 10));
    } catch (_) {}
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

// نسخة محلية محفوظة مؤقتاً لحماية تأخّر الـ replica (انظر ApiService._recentEdits)
class _RecentEdit {
  final Map<String, dynamic> record;
  final int expiresAt; // epoch ms
  _RecentEdit({required this.record, required this.expiresAt});
}
