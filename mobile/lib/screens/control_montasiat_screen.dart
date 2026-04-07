import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// شاشة اطلاع المنتسيات لمدير قسم السيطرة — قراءة وبحث فقط، بدون أزرار إجراءات
class ControlMontasiatScreen extends StatefulWidget {
  final String token;
  final ValueNotifier<int> refreshTrigger;

  const ControlMontasiatScreen({
    super.key,
    required this.token,
    required this.refreshTrigger,
  });

  @override
  State<ControlMontasiatScreen> createState() => _ControlMontasiatScreenState();
}

class _ControlMontasiatScreenState extends State<ControlMontasiatScreen>
    with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> _items = [];
  bool    _loading = false;
  String? _error;
  String  _filter  = 'الكل';
  String  _search  = '';

  static const _filters = ['الكل', 'قيد الاستلام', 'قيد الانتظار', 'تم التسليم', 'مرفوضة'];

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
    final all = (db['montasiat'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((x) => x['deleted'] != true)
        .toList();
    setState(() { _items = all; _loading = false; });
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _filter == 'الكل'
        ? _items
        : _items.where((x) => x['status'] == _filter).toList();
    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      list = list.where((x) {
        final branch  = (x['branch']  ?? '').toString().toLowerCase();
        final city    = (x['city']    ?? '').toString().toLowerCase();
        final notes   = (x['notes']   ?? '').toString().toLowerCase();
        final addedBy = (x['addedBy'] ?? '').toString().toLowerCase();
        return branch.contains(q) || city.contains(q) ||
               notes.contains(q)  || addedBy.contains(q);
      }).toList();
    }
    return list;
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'قيد الاستلام': return const Color(0xFFFFB74D);
      case 'قيد الانتظار': return const Color(0xFF4DD0E1);
      case 'تم التسليم':   return const Color(0xFF81C784);
      case 'مرفوضة':       return const Color(0xFFEF9A9A);
      default:             return Colors.white54;
    }
  }

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(6),
      border: Border.all(color: color.withOpacity(0.4)),
    ),
    child: Text(text, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
  );

  Widget _card(Map<String, dynamic> item) {
    final status  = item['status']  as String? ?? '';
    final branch  = item['branch']  as String? ?? '';
    final city    = item['city']    as String? ?? '';
    final notes   = item['notes']   as String? ?? '';
    final time    = item['time']    as String? ?? '';
    final addedBy = item['addedBy'] as String? ?? '';
    final sc      = _statusColor(status);
    final isMobile = item['source'] == 'mobile';

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
            Row(children: [
              _badge(status, sc),
              if (isMobile) ...[
                const SizedBox(width: 6),
                _badge('📱 جوال', Colors.blue.shade300),
              ],
            ]),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(branch,
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              Text(city,
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ]),
          ]),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(notes,
                textAlign: TextAlign.right, textDirection: TextDirection.rtl,
                maxLines: 3, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4)),
          ],
          if (item['dt'] != null && (item['dt'] as String).isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('📦 سُلِّم: ${item['dt']}',
                textDirection: TextDirection.rtl,
                style: const TextStyle(color: Color(0xFF81C784), fontSize: 11)),
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
    final Map<String, int> counts = {};
    for (final f in _filters) {
      counts[f] = f == 'الكل'
          ? _items.length
          : _items.where((x) => x['status'] == f).length;
    }
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A), borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
        _si('${counts['الكل']}',         'الكل',    Colors.white60),
        _div(),
        _si('${counts['قيد الاستلام']}', 'استلام',  const Color(0xFFFFB74D)),
        _div(),
        _si('${counts['قيد الانتظار']}', 'جاهز',    const Color(0xFF4DD0E1)),
        _div(),
        _si('${counts['تم التسليم']}',   'تسليم',   const Color(0xFF81C784)),
        _div(),
        _si('${counts['مرفوضة']}',       'مرفوض',   const Color(0xFFEF9A9A)),
      ]),
    );
  }

  Widget _si(String v, String l, Color c) => Column(children: [
    Text(v, style: TextStyle(color: c, fontSize: 16, fontWeight: FontWeight.bold)),
    Text(l, style: const TextStyle(color: Colors.white38, fontSize: 9)),
  ]);

  Widget _div() => Container(height: 26, width: 1, color: const Color(0xFF2A2A2A));

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

    final shown = _filtered;

    return Column(children: [
      // شريط البحث
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
        child: TextField(
          textDirection: TextDirection.rtl,
          textAlign: TextAlign.right,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText:  'بحث بالفرع أو المحافظة أو الموظف...',
            hintStyle: const TextStyle(color: Colors.white38, fontSize: 13),
            prefixIcon: const Icon(Icons.search, color: Colors.white38),
            suffixIcon: _search.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close, color: Colors.white38, size: 18),
                    onPressed: () => setState(() => _search = ''),
                  )
                : null,
            filled: true, fillColor: const Color(0xFF1E1E1E),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE53935), width: 1)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),

      // فلاتر الحالة
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(children: _filters.map((f) => Padding(
          padding: const EdgeInsets.only(left: 6),
          child: ChoiceChip(
            label: Text(f,
                style: TextStyle(
                    fontSize: 11,
                    color: f == _filter ? Colors.white : Colors.white60,
                    fontWeight: f == _filter ? FontWeight.bold : FontWeight.normal)),
            selected: f == _filter,
            onSelected: (_) => setState(() => _filter = f),
            selectedColor: const Color(0xFFE53935),
            backgroundColor: const Color(0xFF1E1E1E),
            side: BorderSide(
                color: f == _filter ? const Color(0xFFE53935) : const Color(0xFF333333)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          ),
        )).toList()),
      ),

      Expanded(
        child: RefreshIndicator(
          onRefresh: _load,
          color: const Color(0xFFE53935),
          backgroundColor: const Color(0xFF1E1E1E),
          child: shown.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 100),
                  Center(child: Column(children: [
                    Icon(Icons.search_off, color: Colors.white24, size: 56),
                    SizedBox(height: 12),
                    Text('لا توجد نتائج', style: TextStyle(color: Colors.white38)),
                  ])),
                ])
              : ListView(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                  children: [
                    _buildSummary(),
                    ...shown.map(_card),
                  ],
                ),
        ),
      ),
    ]);
  }
}
