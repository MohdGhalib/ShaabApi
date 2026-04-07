import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ManagerInquiriesScreen extends StatefulWidget {
  final String token;
  final ValueNotifier<int> refreshTrigger;

  const ManagerInquiriesScreen({
    super.key,
    required this.token,
    required this.refreshTrigger,
  });

  @override
  State<ManagerInquiriesScreen> createState() => _ManagerInquiriesScreenState();
}

class _ManagerInquiriesScreenState extends State<ManagerInquiriesScreen>
    with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> _items = [];
  bool    _loading = false;
  String? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
    widget.refreshTrigger.addListener(_load);
  }

  @override
  void dispose() {
    widget.refreshTrigger.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final db = await ApiService.fetchMasterDb(widget.token);
    if (!mounted) return;
    if (db == null) {
      setState(() { _loading = false; _error = 'تعذّر الاتصال بالسيرفر'; });
      return;
    }
    final all = (db['inquiries'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((x) => x['deleted'] != true)
        .toList();
    setState(() { _items = all; _loading = false; });
  }

  Widget _typeColor(String type) {
    Color c = type == 'شكوى'
        ? const Color(0xFFEF9A9A)
        : type == 'استفسار'
            ? const Color(0xFF4DD0E1)
            : const Color(0xFFFFB74D);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(6),
        border: Border.all(color: c.withOpacity(0.4)),
      ),
      child: Text(type, style: TextStyle(color: c, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }

  Widget _card(Map<String, dynamic> item) {
    final type   = item['type']   as String? ?? '';
    final branch = item['branch'] as String? ?? '';
    final city   = item['city']   as String? ?? '';
    final phone  = item['phone']  as String? ?? '';
    final notes  = item['notes']  as String? ?? '';
    final time   = item['time']   as String? ?? '';
    final addedBy= item['addedBy']as String? ?? '';
    final seq    = item['seq'];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            _typeColor(type),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('$branch — $city',
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              if (seq != null)
                Text('#$seq', style: const TextStyle(color: Colors.white38, fontSize: 11)),
            ]),
          ]),
          if (phone.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              Text(phone, style: const TextStyle(color: Color(0xFF4DD0E1), fontSize: 13)),
              const SizedBox(width: 6),
              const Icon(Icons.phone, color: Color(0xFF4DD0E1), size: 14),
            ]),
          ],
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notes,
                textAlign: TextAlign.right, textDirection: TextDirection.rtl,
                maxLines: 3, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4)),
          ],
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('🕐 $time', style: const TextStyle(color: Colors.white38, fontSize: 11)),
            Text('👤 $addedBy',
                textDirection: TextDirection.rtl,
                style: const TextStyle(color: Colors.white38, fontSize: 11)),
          ]),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFE53935)));
    }
    if (_error != null) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(_error!, style: const TextStyle(color: Colors.white54)),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: _load,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53935)),
            child: const Text('إعادة المحاولة')),
      ]));
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: const Color(0xFFE53935),
      backgroundColor: const Color(0xFF1E1E1E),
      child: _items.isEmpty
          ? ListView(children: const [
              SizedBox(height: 100),
              Center(child: Column(children: [
                Icon(Icons.help_outline, color: Colors.white24, size: 56),
                SizedBox(height: 12),
                Text('لا توجد استفسارات', style: TextStyle(color: Colors.white38, fontSize: 15)),
              ])),
            ])
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _items.length + 1,
              itemBuilder: (_, i) {
                if (i == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A1A1A),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF2A2A2A)),
                      ),
                      child: Text(
                        'إجمالي الاستفسارات: ${_items.length}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white60, fontSize: 13),
                      ),
                    ),
                  );
                }
                return _card(_items[i - 1]);
              },
            ),
    );
  }
}
