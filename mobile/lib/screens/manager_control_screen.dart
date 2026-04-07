import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ManagerControlScreen extends StatefulWidget {
  final String token;
  final ValueNotifier<int> refreshTrigger;

  const ManagerControlScreen({
    super.key,
    required this.token,
    required this.refreshTrigger,
  });

  @override
  State<ManagerControlScreen> createState() => _ManagerControlScreenState();
}

class _ManagerControlScreenState extends State<ManagerControlScreen>
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
    final all = (db['complaints'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((x) => x['deleted'] != true)
        .toList();
    setState(() { _items = all; _loading = false; });
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'تمت الموافقة': return const Color(0xFF81C784);
      case 'بانتظار الموافقة': return const Color(0xFFFFB74D);
      case 'تم الرد': return const Color(0xFF4DD0E1);
      default: return Colors.white54;
    }
  }

  Widget _card(Map<String, dynamic> item) {
    final status  = item['status']  as String? ?? '';
    final branch  = item['branch']  as String? ?? '';
    final city    = item['city']    as String? ?? '';
    final notes   = item['notes']   as String? ?? '';
    final time    = item['time']    as String? ?? '';
    final addedBy = item['addedBy'] as String? ?? '';
    final audit   = item['audit']   as String? ?? '';
    final sc      = _statusColor(status);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: status == 'بانتظار الموافقة'
              ? const Color(0xFFFFB74D).withOpacity(0.4)
              : const Color(0xFF2A2A2A),
          width: status == 'بانتظار الموافقة' ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: sc.withOpacity(0.12), borderRadius: BorderRadius.circular(6),
                border: Border.all(color: sc.withOpacity(0.4)),
              ),
              child: Text(status, style: TextStyle(color: sc, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('$branch — $city',
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
            ]),
          ]),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(notes,
                textAlign: TextAlign.right, textDirection: TextDirection.rtl,
                maxLines: 3, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4)),
          ],
          if (audit.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF252525), borderRadius: BorderRadius.circular(8),
              ),
              child: Text('💬 $audit',
                  textAlign: TextAlign.right, textDirection: TextDirection.rtl,
                  style: const TextStyle(color: Color(0xFF4DD0E1), fontSize: 12)),
            ),
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

  Widget _buildSummary() {
    final pending  = _items.where((x) => x['status'] == 'بانتظار الموافقة').length;
    final approved = _items.where((x) => x['status'] == 'تمت الموافقة').length;
    final replied  = _items.where((x) => (x['audit'] as String? ?? '').isNotEmpty).length;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A), borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
        _si('${_items.length}', 'الكل',     Colors.white60),
        _div(),
        _si('$pending',  'انتظار',    const Color(0xFFFFB74D)),
        _div(),
        _si('$approved', 'موافقة',    const Color(0xFF81C784)),
        _div(),
        _si('$replied',  'تم الرد',   const Color(0xFF4DD0E1)),
      ]),
    );
  }

  Widget _si(String v, String l, Color c) => Column(children: [
    Text(v, style: TextStyle(color: c, fontSize: 18, fontWeight: FontWeight.bold)),
    Text(l, style: const TextStyle(color: Colors.white38, fontSize: 9)),
  ]);

  Widget _div() => Container(height: 28, width: 1, color: const Color(0xFF2A2A2A));

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
                Icon(Icons.security_outlined, color: Colors.white24, size: 56),
                SizedBox(height: 12),
                Text('لا توجد شكاوى', style: TextStyle(color: Colors.white38, fontSize: 15)),
              ])),
            ])
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _items.length + 1,
              itemBuilder: (_, i) {
                if (i == 0) return _buildSummary();
                return _card(_items[i - 1]);
              },
            ),
    );
  }
}
