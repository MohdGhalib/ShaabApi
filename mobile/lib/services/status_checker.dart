import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'notification_service.dart';

class StatusChecker {
  static const _savedKey = '_shaab_montasiat_statuses';

  /// يُحفظ عند كل تحميل للقائمة (بدون إشعار) حتى نتعرف على الحالة الأخيرة
  static Future<void> saveSeenStatuses(
      List<Map<String, dynamic>> items) async {
    final prefs = await SharedPreferences.getInstance();
    final map = <String, String>{};
    for (final item in items) {
      map[item['id'].toString()] = item['status'] as String? ?? '';
    }
    await prefs.setString(_savedKey, jsonEncode(map));
  }

  /// يُستدعى من الخلفية أو عند استئناف التطبيق
  /// يقارن الحالات ويطلق إشعارات عند أي تغيير
  static Future<void> check() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('_shaab_token') ?? '';
    final name  = prefs.getString('_shaab_name')  ?? '';
    if (token.isEmpty || name.isEmpty) return;

    final db = await ApiService.fetchMasterDb(token);
    if (db == null) return;

    final items = (db['montasiat'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((x) =>
            x['deleted'] != true &&
            (x['addedBy'] ?? '') == name &&
            x['source'] == 'mobile')
        .toList();

    final savedJson = prefs.getString(_savedKey) ?? '{}';
    final saved = Map<String, String>.from(
        (jsonDecode(savedJson) as Map).map(
            (k, v) => MapEntry(k.toString(), v.toString())));

    final newSaved = Map<String, String>.from(saved);
    int notifId = DateTime.now().millisecondsSinceEpoch % 100000;

    for (final item in items) {
      final id     = item['id'].toString();
      final status = item['status'] as String? ?? '';
      final prev   = saved[id];
      final branch = item['branch'] as String? ?? '';
      final city   = item['city']   as String? ?? '';

      // أول مرة نشوف هذا البند → فقط نحفظ
      if (prev == null) {
        newSaved[id] = status;
        continue;
      }

      // لم تتغير الحالة
      if (prev == status) continue;

      // تغيرت الحالة → نحدد نص الإشعار
      String title = '';
      if (status == 'قيد الانتظار') {
        title = 'تمت الموافقة على منتسيتك ✅';
      } else if (status == 'تم التسليم') {
        title = 'تم تسليم منتسيتك 📦';
      } else if (status == 'مرفوضة') {
        title = 'تم رفض منتسيتك ❌';
      }

      if (title.isNotEmpty) {
        final type    = item['type']   as String? ?? '';
        final notes   = item['notes']  as String? ?? '';
        final snippet = notes.length > 60 ? '${notes.substring(0, 60)}…' : notes;
        final parts   = <String>[
          if (type.isNotEmpty)   type,
          '$branch — $city',
          if (snippet.isNotEmpty) snippet,
        ];
        await NotificationService.show(
          notifId++, title, parts.join('\n'),
          payload: id,
        );
      }

      newSaved[id] = status;
    }

    await prefs.setString(_savedKey, jsonEncode(newSaved));
  }
}
