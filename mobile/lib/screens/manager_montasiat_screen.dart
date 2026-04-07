import 'package:flutter/material.dart';
import '../constants.dart';
import '../services/api_service.dart';

class ManagerMontasiatScreen extends StatefulWidget {
  final String token;
  final String name;
  final ValueNotifier<int> refreshTrigger;

  const ManagerMontasiatScreen({
    super.key,
    required this.token,
    required this.name,
    required this.refreshTrigger,
  });

  @override
  State<ManagerMontasiatScreen> createState() => _ManagerMontasiatScreenState();
}

class _ManagerMontasiatScreenState extends State<ManagerMontasiatScreen>
    with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> _items = [];
  bool    _loading = false;
  String? _error;
  String  _filter  = 'الكل';

  static const _filters = ['الكل', 'قيد الاستلام', 'جاهز للتسليم', 'تم التسليم', 'مرفوضة'];

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
    if (_filter == 'الكل') return _items;
    if (_filter == 'جاهز للتسليم') {
      return _items.where((x) => x['status'] == 'قيد الانتظار').toList();
    }
    return _items.where((x) => x['status'] == _filter).toList();
  }

  // ── موافقة ──────────────────────────────────────────────────────────
  Future<void> _approve(Map<String, dynamic> item) async {
    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) { _snack('تعذّر الاتصال', isError: true); return; }
    final list = (db['montasiat'] as List).cast<Map<String, dynamic>>();
    final idx  = list.indexWhere((x) => x['id'] == item['id']);
    if (idx == -1) { _snack('لم يُعثر على المنتسية', isError: true); return; }
    list[idx]['status']     = 'قيد الانتظار';
    list[idx]['approvedBy'] = widget.name;
    list[idx]['approvedAt'] = _nowStr();
    db['montasiat'] = list;
    final ok = await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;
    ok ? _snack('تمت الموافقة ✓') : _snack('فشل الحفظ', isError: true);
    _load();
  }

  // ── رفض ─────────────────────────────────────────────────────────────
  Future<void> _reject(Map<String, dynamic> item) async {
    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) { _snack('تعذّر الاتصال', isError: true); return; }
    final list = (db['montasiat'] as List).cast<Map<String, dynamic>>();
    final idx  = list.indexWhere((x) => x['id'] == item['id']);
    if (idx == -1) return;
    list[idx]['status']     = 'مرفوضة';
    list[idx]['rejectedBy'] = widget.name;
    db['montasiat'] = list;
    final ok = await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;
    ok ? _snack('تم الرفض') : _snack('فشل الحفظ', isError: true);
    _load();
  }

  // ── تسليم ────────────────────────────────────────────────────────────
  Future<void> _openDeliverDialog(Map<String, dynamic> item) async {
    String  deliverType    = 'same';
    String? selectedCity;
    String? selectedBranch;
    List<String> branchList = [];

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            backgroundColor: const Color(0xFF1E1E1E),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            title: Row(children: [
              const Icon(Icons.local_shipping_outlined, color: Color(0xFF4DD0E1), size: 22),
              const SizedBox(width: 8),
              const Text('تسليم المنتسية',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
            ]),
            content: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _infoBox(item),
                const SizedBox(height: 14),
                _radioCard('نفس الفرع  (${item['branch']})', 'same', deliverType,
                    () => setDlg(() { deliverType = 'same'; selectedCity = null; selectedBranch = null; })),
                const SizedBox(height: 8),
                _radioCard('فرع آخر', 'other', deliverType,
                    () => setDlg(() => deliverType = 'other')),
                if (deliverType == 'other') ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: selectedCity,
                    isExpanded: true,
                    dropdownColor: const Color(0xFF252525),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: _dropDeco('المحافظة'),
                    hint: const Text('اختر', style: TextStyle(color: Colors.white38)),
                    items: kBranches.keys.map((c) =>
                        DropdownMenuItem(value: c, child: Text(c, textDirection: TextDirection.rtl))).toList(),
                    onChanged: (v) => setDlg(() {
                      selectedCity = v; selectedBranch = null; branchList = kBranches[v] ?? [];
                    }),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: selectedBranch,
                    isExpanded: true,
                    dropdownColor: const Color(0xFF252525),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: _dropDeco('الفرع'),
                    hint: const Text('اختر', style: TextStyle(color: Colors.white38)),
                    items: branchList.map((b) =>
                        DropdownMenuItem(value: b, child: Text(b, textDirection: TextDirection.rtl))).toList(),
                    onChanged: selectedCity == null ? null : (v) => setDlg(() => selectedBranch = v),
                  ),
                ],
              ]),
            ),
            actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, null),
                  child: const Text('إلغاء', style: TextStyle(color: Colors.white54))),
              ElevatedButton.icon(
                icon: const Icon(Icons.check, size: 18),
                label: const Text('تسليم', style: TextStyle(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  if (deliverType == 'other' && (selectedCity == null || selectedBranch == null)) {
                    _snack('اختر المحافظة والفرع', isError: true); return;
                  }
                  Navigator.pop(ctx, {'type': deliverType, 'city': selectedCity, 'branch': selectedBranch});
                },
              ),
            ],
          ),
        ),
      ),
    );

    if (result == null) return;
    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) { _snack('تعذّر الاتصال', isError: true); return; }
    final list = (db['montasiat'] as List).cast<Map<String, dynamic>>();
    final idx  = list.indexWhere((x) => x['id'] == item['id']);
    if (idx == -1) return;
    list[idx]['status']      = 'تم التسليم';
    list[idx]['deliveredBy'] = widget.name;
    list[idx]['dt']          = _nowStr();
    if (result['type'] == 'other') {
      list[idx]['deliveryCity']   = result['city'];
      list[idx]['deliveryBranch'] = result['branch'];
    }
    db['montasiat'] = list;
    final ok = await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;
    ok ? _snack('تم التسليم بنجاح ✓') : _snack('فشل الحفظ', isError: true);
    _load();
  }

  Widget _infoBox(Map<String, dynamic> item) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: const Color(0xFF252525), borderRadius: BorderRadius.circular(10)),
    child: Text('${item['branch']} — ${item['city']}',
        textDirection: TextDirection.rtl,
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
  );

  Widget _radioCard(String label, String value, String current, VoidCallback onTap) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: current == value ? const Color(0xFF4DD0E1).withOpacity(0.1) : const Color(0xFF252525),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: current == value ? const Color(0xFF4DD0E1) : const Color(0xFF333333),
              width: current == value ? 1.5 : 1,
            ),
          ),
          child: Row(children: [
            Icon(current == value ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                color: current == value ? const Color(0xFF4DD0E1) : Colors.white38, size: 20),
            const SizedBox(width: 10),
            Text(label, style: const TextStyle(color: Colors.white, fontSize: 14)),
          ]),
        ),
      );

  InputDecoration _dropDeco(String label) => InputDecoration(
    labelText: label, labelStyle: const TextStyle(color: Colors.white54),
    filled: true, fillColor: const Color(0xFF252525),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
  );

  String _nowStr() {
    final n = DateTime.now();
    return '${n.hour.toString().padLeft(2,'0')}:${n.minute.toString().padLeft(2,'0')}'
        ' | ${n.day.toString().padLeft(2,'0')}/${n.month.toString().padLeft(2,'0')}/${n.year}';
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, textDirection: TextDirection.rtl),
      backgroundColor: isError ? const Color(0xFFB71C1C) : const Color(0xFF2E7D32),
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── بطاقة المنتسية ──────────────────────────────────────────────────
  Widget _card(Map<String, dynamic> item) {
    final status   = item['status'] as String? ?? '';
    final isPending = status == 'قيد الاستلام';
    final isReady   = status == 'قيد الانتظار';
    final isDone    = status == 'تم التسليم';
    final isRejected= status == 'مرفوضة';
    final isMobile  = item['source'] == 'mobile';

    Color sc = isPending ? const Color(0xFFFFB74D)
        : isReady   ? const Color(0xFF4DD0E1)
        : isDone    ? const Color(0xFF81C784)
        : isRejected? const Color(0xFFEF9A9A)
        : Colors.white54;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isPending ? const Color(0xFFFFB74D).withOpacity(0.4) : const Color(0xFF2A2A2A),
          width: isPending ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          // الرأس
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Row(children: [
              _badge(status, sc),
              if (isMobile) ...[
                const SizedBox(width: 6),
                _badge('📱 جوال', Colors.blue.shade300),
              ],
            ]),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('${item['branch']}',
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              Text('${item['city']}',
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ]),
          ]),
          if (item['notes'] != null) ...[
            const SizedBox(height: 8),
            Text(item['notes'] as String,
                textAlign: TextAlign.right,
                textDirection: TextDirection.rtl,
                maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4)),
          ],
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('🕐 ${item['time'] ?? ''}',
                style: const TextStyle(color: Colors.white38, fontSize: 11)),
            Text('👤 ${item['addedBy'] ?? ''}',
                textDirection: TextDirection.rtl,
                style: const TextStyle(color: Colors.white38, fontSize: 11)),
          ]),
          // أزرار الإجراءات
          if (isPending) ...[
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.close, size: 16, color: Color(0xFFEF9A9A)),
                  label: const Text('رفض', style: TextStyle(color: Color(0xFFEF9A9A), fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0x55EF9A9A)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () => _reject(item),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.check, size: 16),
                  label: const Text('موافقة', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1565C0),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    elevation: 0,
                  ),
                  onPressed: () => _approve(item),
                ),
              ),
            ]),
          ],
          if (isReady) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.local_shipping_outlined, size: 16),
                label: const Text('تسليم', style: TextStyle(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  elevation: 0, padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onPressed: () => _openDeliverDialog(item),
              ),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(6),
      border: Border.all(color: color.withOpacity(0.4)),
    ),
    child: Text(text, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
  );

  // ── ملخص الأعداد ────────────────────────────────────────────────────
  Widget _buildSummary() {
    final pending   = _items.where((x) => x['status'] == 'قيد الاستلام').length;
    final ready     = _items.where((x) => x['status'] == 'قيد الانتظار').length;
    final delivered = _items.where((x) => x['status'] == 'تم التسليم').length;
    final rejected  = _items.where((x) => x['status'] == 'مرفوضة').length;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
        _summItem('${_items.length}', 'الكل', Colors.white60),
        _divider(),
        _summItem('$pending', 'قيد الاستلام', const Color(0xFFFFB74D)),
        _divider(),
        _summItem('$ready',   'جاهز',          const Color(0xFF4DD0E1)),
        _divider(),
        _summItem('$delivered','تسليم',         const Color(0xFF81C784)),
        _divider(),
        _summItem('$rejected', 'مرفوض',         const Color(0xFFEF9A9A)),
      ]),
    );
  }

  Widget _summItem(String count, String label, Color color) => Column(children: [
    Text(count, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.bold)),
    Text(label, style: const TextStyle(color: Colors.white38, fontSize: 9)),
  ]);

  Widget _divider() => Container(height: 30, width: 1, color: const Color(0xFF2A2A2A));

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
      // فلاتر الحالة
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(children: _filters.map((f) {
          final active = f == _filter ||
              (f == 'جاهز للتسليم' && _filter == 'جاهز للتسليم');
          return Padding(
            padding: const EdgeInsets.only(left: 8),
            child: ChoiceChip(
              label: Text(f == 'جاهز للتسليم' ? 'جاهز' : f,
                  style: TextStyle(
                      fontSize: 12, color: active ? Colors.white : Colors.white60,
                      fontWeight: active ? FontWeight.bold : FontWeight.normal)),
              selected: f == _filter,
              onSelected: (_) => setState(() => _filter = f),
              selectedColor: const Color(0xFFE53935),
              backgroundColor: const Color(0xFF1E1E1E),
              side: BorderSide(
                  color: f == _filter ? const Color(0xFFE53935) : const Color(0xFF333333)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
          );
        }).toList()),
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
                    Icon(Icons.inbox_outlined, color: Colors.white24, size: 56),
                    SizedBox(height: 12),
                    Text('لا توجد منتسيات', style: TextStyle(color: Colors.white38)),
                  ])),
                ])
              : ListView(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                  children: [
                    _buildSummary(),
                    const SizedBox(height: 12),
                    ...shown.map(_card),
                  ],
                ),
        ),
      ),
    ]);
  }
}
