import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class MyMontasiatScreen extends StatefulWidget {
  final String token;
  final String name;

  const MyMontasiatScreen({
    super.key,
    required this.token,
    required this.name,
  });

  @override
  State<MyMontasiatScreen> createState() => _MyMontasiatScreenState();
}

class _MyMontasiatScreenState extends State<MyMontasiatScreen>
    with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> _items = [];
  bool _loading = false;
  String? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final db = await ApiService.fetchMasterDb(widget.token);
    if (!mounted) return;
    if (db == null) {
      setState(() { _loading = false; _error = 'تعذّر الاتصال بالسيرفر'; });
      return;
    }
    final all = (db['montasiat'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((x) =>
            x['deleted'] != true &&
            (x['addedBy'] ?? '') == widget.name &&
            x['source'] == 'mobile')
        .toList();
    setState(() { _items = all; _loading = false; });
  }

  // ── تسليم المنتسية ───────────────────────────────────────────────────
  Future<void> _deliver(Map<String, dynamic> item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('تأكيد التسليم',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('${item['branch']} — ${item['city']}',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
              const SizedBox(height: 8),
              Text(
                (item['notes'] as String? ?? '').length > 80
                    ? '${(item['notes'] as String).substring(0, 80)}...'
                    : (item['notes'] as String? ?? ''),
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 14),
              const Text('هل تأكد تسليم هذه المنتسية؟',
                  style: TextStyle(color: Color(0xFFFFCA28), fontSize: 13)),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF388E3C),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('تسليم', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );

    if (confirm != true) return;

    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) { _snack('تعذّر الاتصال بالسيرفر', isError: true); return; }

    final list = (db['montasiat'] as List).cast<Map<String, dynamic>>();
    final idx  = list.indexWhere((x) => x['id'] == item['id']);
    if (idx == -1) { _snack('لم يُعثر على المنتسية', isError: true); return; }

    final now = DateTime.now();
    final timeStr =
        '${now.hour.toString().padLeft(2,'0')}:${now.minute.toString().padLeft(2,'0')}'
        ' | ${now.day.toString().padLeft(2,'0')}/${now.month.toString().padLeft(2,'0')}/${now.year}';

    list[idx]['status']      = 'تم التسليم';
    list[idx]['deliveredBy'] = widget.name;
    list[idx]['dt']          = timeStr;
    db['montasiat'] = list;

    final ok = await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;

    if (ok) {
      _snack('تم التسليم بنجاح ✓');
      _load();
    } else {
      _snack('فشل الحفظ، حاول مرة أخرى', isError: true);
    }
  }

  void _snack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, textDirection: TextDirection.rtl),
      backgroundColor: isError ? const Color(0xFFB71C1C) : const Color(0xFF2E7D32),
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── بطاقة المنتسية ──────────────────────────────────────────────────
  Widget _card(Map<String, dynamic> item) {
    final status     = item['status'] as String? ?? '';
    final approved   = status == 'تمت الموافقة';
    final delivered  = status == 'تم التسليم';
    final pending    = status == 'قيد الاستلام';
    final rejected   = status == 'مرفوضة';
    final hasPhoto   = item['photoBase64'] != null;

    Color statusColor;
    if (delivered)       statusColor = const Color(0xFF81C784);
    else if (approved)   statusColor = const Color(0xFF4DD0E1);
    else if (rejected)   statusColor = const Color(0xFFEF9A9A);
    else                 statusColor = const Color(0xFFFFB74D);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: approved
              ? const Color(0xFF4DD0E1).withOpacity(0.4)
              : const Color(0xFF2A2A2A),
          width: approved ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [

          // ── رأس البطاقة ─────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // شارة الحالة
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withOpacity(0.4)),
                  ),
                  child: Text(status,
                      style: TextStyle(
                          color: statusColor, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
                // الفرع والمحافظة
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${item['branch']}',
                        textDirection: TextDirection.rtl,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 15)),
                    Text('${item['city']}',
                        textDirection: TextDirection.rtl,
                        style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  ],
                ),
              ],
            ),
          ),

          // ── التفاصيل ────────────────────────────────
          if (item['notes'] != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(
                item['notes'] as String,
                textAlign: TextAlign.right,
                textDirection: TextDirection.rtl,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
              ),
            ),

          // ── الصورة ──────────────────────────────────
          if (hasPhoto)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.memory(
                  base64Decode(item['photoBase64'] as String),
                  height: 140,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            ),

          // ── الوقت ───────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (delivered && item['dt'] != null)
                  Text('⏱ ${item['dt']}',
                      style: const TextStyle(color: Color(0xFF81C784), fontSize: 11)),
                const Spacer(),
                Text('🕐 ${item['time'] ?? ''}',
                    style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ),

          // ── زر التسليم (فقط بعد الموافقة) ──────────
          if (approved)
            Padding(
              padding: const EdgeInsets.all(14),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: const Text('تسليم المنتسية',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2E7D32),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  onPressed: () => _deliver(item),
                ),
              ),
            )
          else
            const SizedBox(height: 14),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return _loading
        ? const Center(
            child: CircularProgressIndicator(color: Color(0xFFE53935)))
        : _error != null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!,
                        style: const TextStyle(color: Colors.white54)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _load,
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE53935)),
                      child: const Text('إعادة المحاولة'),
                    ),
                  ],
                ),
              )
            : RefreshIndicator(
                onRefresh: _load,
                color: const Color(0xFFE53935),
                backgroundColor: const Color(0xFF1E1E1E),
                child: _items.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 120),
                          Center(
                            child: Column(
                              children: [
                                Icon(Icons.inbox_outlined,
                                    color: Colors.white24, size: 64),
                                SizedBox(height: 16),
                                Text('لم ترسل أي منتسية بعد',
                                    style: TextStyle(
                                        color: Colors.white38, fontSize: 16)),
                              ],
                            ),
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          // ملخص سريع
                          _buildSummary(),
                          const SizedBox(height: 16),
                          // البطاقات
                          ..._items.map(_card),
                          const SizedBox(height: 20),
                          // تلميح السحب
                          const Center(
                            child: Text('اسحب للأسفل للتحديث',
                                style: TextStyle(
                                    color: Colors.white24, fontSize: 12)),
                          ),
                        ],
                      ),
              );
  }

  Widget _buildSummary() {
    final pending   = _items.where((x) => x['status'] == 'قيد الاستلام').length;
    final approved  = _items.where((x) => x['status'] == 'تمت الموافقة').length;
    final delivered = _items.where((x) => x['status'] == 'تم التسليم').length;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _summaryItem('قيد الاستلام', pending,   const Color(0xFFFFB74D)),
          _vDivider(),
          _summaryItem('بانتظار التسليم', approved,  const Color(0xFF4DD0E1)),
          _vDivider(),
          _summaryItem('تم التسليم',  delivered, const Color(0xFF81C784)),
        ],
      ),
    );
  }

  Widget _summaryItem(String label, int count, Color color) => Column(
    children: [
      Text('$count',
          style: TextStyle(
              color: color, fontSize: 22, fontWeight: FontWeight.bold)),
      const SizedBox(height: 2),
      Text(label,
          textDirection: TextDirection.rtl,
          style: const TextStyle(color: Colors.white54, fontSize: 10)),
    ],
  );

  Widget _vDivider() => Container(
      height: 36, width: 1, color: const Color(0xFF2A2A2A));
}
