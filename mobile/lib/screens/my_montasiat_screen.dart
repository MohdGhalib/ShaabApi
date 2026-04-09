import 'dart:convert';
import 'package:flutter/material.dart';
import '../constants.dart';
import '../services/api_service.dart';
import '../services/navigation_service.dart';
import '../services/status_checker.dart';

class MyMontasiatScreen extends StatefulWidget {
  final String token;
  final String name;
  final String empId;
  final ValueNotifier<int> refreshTrigger;

  const MyMontasiatScreen({
    super.key,
    required this.token,
    required this.name,
    required this.refreshTrigger,
    this.empId = '',
  });

  @override
  State<MyMontasiatScreen> createState() => _MyMontasiatScreenState();
}

class _MyMontasiatScreenState extends State<MyMontasiatScreen>
    with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> _items = [];
  List<String> _assignedBranches = [];
  bool    _loading = false;
  String? _error;

  final ScrollController _scrollCtrl = ScrollController();
  final Map<int, GlobalKey> _itemKeys = {};
  int? _highlightId;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadAssigned().then((_) => _load());
    widget.refreshTrigger.addListener(_load);
    NavigationService.pendingMontasiaId.addListener(_onPendingMontasia);
  }

  @override
  void dispose() {
    NavigationService.pendingMontasiaId.removeListener(_onPendingMontasia);
    widget.refreshTrigger.removeListener(_load);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onPendingMontasia() {
    final id = NavigationService.pendingMontasiaId.value;
    if (id != null) {
      setState(() => _highlightId = id);
      _scrollToHighlighted();
    }
  }

  void _scrollToHighlighted() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final key = _itemKeys[_highlightId];
      if (key?.currentContext != null) {
        Scrollable.ensureVisible(
          key!.currentContext!,
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeInOut,
          alignment: 0.1,
        );
      }
    });
  }

  int _itemId(Map<String, dynamic> item) {
    final v = item['id'];
    if (v is int) return v;
    if (v is double) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  Future<void> _loadAssigned() async {
    if (widget.empId.isEmpty) return;
    final emps = await ApiService.fetchEmployeesDb(widget.token);
    if (emps == null || !mounted) return;
    final emp = emps
        .where((e) => e['empId']?.toString() == widget.empId)
        .firstOrNull;
    if (emp == null) return;

    List<String> branches = [];
    final multi = emp['assignedBranches'];
    if (multi is List && multi.isNotEmpty) {
      branches = multi
          .map((e) => (e as Map<String, dynamic>)['branch']?.toString() ?? '')
          .where((b) => b.isNotEmpty)
          .toList();
    }
    if (branches.isEmpty) {
      final single = emp['assignedBranch'];
      if (single is Map) {
        final b = single['branch']?.toString() ?? '';
        if (b.isNotEmpty) branches = [b];
      }
    }
    if (mounted) setState(() => _assignedBranches = branches);
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
        .where((x) {
          if (x['deleted'] == true) return false;
          if ((x['addedBy'] ?? '') != widget.name) return false;
          if (x['source'] != 'mobile') return false;
          // فلترة حسب الفروع المخصصة إن وُجدت
          if (_assignedBranches.isNotEmpty) {
            return _assignedBranches.contains(x['branch']?.toString());
          }
          return true;
        })
        .toList();
    final pending = NavigationService.pendingMontasiaId.value;
    setState(() {
      _items = all;
      _loading = false;
      if (pending != null) _highlightId = pending;
    });
    await StatusChecker.saveSeenStatuses(all);
    if (pending != null) {
      _scrollToHighlighted();
      // مسح الـ pending بعد 3 ثواني (بعد أن يشاهد المستخدم المنتسية)
      Future.delayed(const Duration(seconds: 3), () {
        if (NavigationService.pendingMontasiaId.value == pending) {
          NavigationService.pendingMontasiaId.value = null;
          if (mounted) setState(() => _highlightId = null);
        }
      });
    }
  }

  // ── نافذة التسليم الكاملة ───────────────────────────────────────────
  Future<void> _openDeliverDialog(Map<String, dynamic> item) async {
    String  deliverType    = 'same';  // 'same' | 'other'
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
            titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            contentPadding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
            title: Row(
              children: [
                const Icon(Icons.local_shipping_outlined,
                    color: Color(0xFF4DD0E1), size: 22),
                const SizedBox(width: 8),
                const Text('تسليم المنتسية',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.bold)),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // معلومات المنتسية
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF252525),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('${item['branch']} — ${item['city']}',
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 14)),
                        if (item['notes'] != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            (item['notes'] as String).length > 60
                                ? '${(item['notes'] as String).substring(0, 60)}...'
                                : item['notes'] as String,
                            style: const TextStyle(
                                color: Colors.white60, fontSize: 12),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // اختيار نوع التسليم
                  const Text('جهة التسليم',
                      style: TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),

                  // نفس الفرع
                  GestureDetector(
                    onTap: () => setDlg(() {
                      deliverType    = 'same';
                      selectedCity   = null;
                      selectedBranch = null;
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: deliverType == 'same'
                            ? const Color(0xFF4DD0E1).withOpacity(0.1)
                            : const Color(0xFF252525),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: deliverType == 'same'
                              ? const Color(0xFF4DD0E1)
                              : const Color(0xFF333333),
                          width: deliverType == 'same' ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            deliverType == 'same'
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked,
                            color: deliverType == 'same'
                                ? const Color(0xFF4DD0E1)
                                : Colors.white38,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Text('نفس الفرع  (${item['branch']})',
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 14)),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // فرع آخر
                  GestureDetector(
                    onTap: () => setDlg(() => deliverType = 'other'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: deliverType == 'other'
                            ? const Color(0xFF4DD0E1).withOpacity(0.1)
                            : const Color(0xFF252525),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: deliverType == 'other'
                              ? const Color(0xFF4DD0E1)
                              : const Color(0xFF333333),
                          width: deliverType == 'other' ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            deliverType == 'other'
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked,
                            color: deliverType == 'other'
                                ? const Color(0xFF4DD0E1)
                                : Colors.white38,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          const Text('فرع آخر',
                              style: TextStyle(color: Colors.white, fontSize: 14)),
                        ],
                      ),
                    ),
                  ),

                  // اختيار المحافظة والفرع عند "فرع آخر"
                  if (deliverType == 'other') ...[
                    const SizedBox(height: 14),

                    // المحافظة
                    DropdownButtonFormField<String>(
                      value: selectedCity,
                      isExpanded: true,
                      dropdownColor: const Color(0xFF252525),
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      iconEnabledColor: const Color(0xFF4DD0E1),
                      decoration: InputDecoration(
                        labelText: 'المحافظة',
                        labelStyle: const TextStyle(color: Colors.white54),
                        filled: true,
                        fillColor: const Color(0xFF252525),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(
                                color: Color(0xFF4DD0E1), width: 1.5)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 12),
                      ),
                      hint: const Text('اختر المحافظة',
                          style: TextStyle(color: Colors.white38)),
                      items: kBranches.keys
                          .map((c) => DropdownMenuItem(
                                value: c,
                                child: Text(c,
                                    textDirection: TextDirection.rtl),
                              ))
                          .toList(),
                      onChanged: (v) => setDlg(() {
                        selectedCity   = v;
                        selectedBranch = null;
                        branchList     = kBranches[v] ?? [];
                      }),
                    ),

                    const SizedBox(height: 10),

                    // الفرع
                    DropdownButtonFormField<String>(
                      value: selectedBranch,
                      isExpanded: true,
                      dropdownColor: const Color(0xFF252525),
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      iconEnabledColor: const Color(0xFF4DD0E1),
                      decoration: InputDecoration(
                        labelText: 'الفرع',
                        labelStyle: const TextStyle(color: Colors.white54),
                        filled: true,
                        fillColor: const Color(0xFF252525),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(
                                color: Color(0xFF4DD0E1), width: 1.5)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 12),
                      ),
                      hint: const Text('اختر الفرع',
                          style: TextStyle(color: Colors.white38)),
                      items: branchList
                          .map((b) => DropdownMenuItem(
                                value: b,
                                child: Text(b,
                                    textDirection: TextDirection.rtl),
                              ))
                          .toList(),
                      onChanged: selectedCity == null
                          ? null
                          : (v) => setDlg(() => selectedBranch = v),
                    ),
                  ],

                  const SizedBox(height: 6),
                ],
              ),
            ),
            actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, null),
                child: const Text('إلغاء',
                    style: TextStyle(color: Colors.white54)),
              ),
              ElevatedButton.icon(
                icon: const Icon(Icons.check, size: 18),
                label: const Text('تسليم',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E7D32),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 10),
                ),
                onPressed: () {
                  if (deliverType == 'other') {
                    if (selectedCity == null) {
                      ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
                        content: Text('اختر المحافظة',
                            textDirection: TextDirection.rtl),
                        backgroundColor: Color(0xFFB71C1C),
                        behavior: SnackBarBehavior.floating,
                      ));
                      return;
                    }
                    if (selectedBranch == null) {
                      ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
                        content: Text('اختر الفرع',
                            textDirection: TextDirection.rtl),
                        backgroundColor: Color(0xFFB71C1C),
                        behavior: SnackBarBehavior.floating,
                      ));
                      return;
                    }
                  }
                  Navigator.pop(ctx, {
                    'type':   deliverType,
                    'city':   selectedCity,
                    'branch': selectedBranch,
                  });
                },
              ),
            ],
          ),
        ),
      ),
    );

    if (result == null) return;
    await _commitDeliver(item, result);
  }

  // ── تأكيد الحفظ ─────────────────────────────────────────────────────
  Future<void> _commitDeliver(
      Map<String, dynamic> item, Map<String, dynamic> delivery) async {
    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) { _snack('تعذّر الاتصال بالسيرفر', isError: true); return; }

    final list = (db['montasiat'] as List).cast<Map<String, dynamic>>();
    final idx  = list.indexWhere((x) => x['id'] == item['id']);
    if (idx == -1) { _snack('لم يُعثر على المنتسية', isError: true); return; }

    final now = DateTime.now();
    final timeStr =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}'
        ' | ${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';

    list[idx]['status']      = 'تم التسليم';
    list[idx]['deliveredBy'] = widget.name;
    list[idx]['dt']          = timeStr;

    if (delivery['type'] == 'other') {
      list[idx]['deliveryCity']   = delivery['city'];
      list[idx]['deliveryBranch'] = delivery['branch'];
    }

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
      backgroundColor:
          isError ? const Color(0xFFB71C1C) : const Color(0xFF2E7D32),
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── بطاقة المنتسية ──────────────────────────────────────────────────
  Widget _card(Map<String, dynamic> item) {
    final id        = _itemId(item);
    final key       = _itemKeys.putIfAbsent(id, GlobalKey.new);
    final isHighlit = _highlightId == id;

    final status    = item['status'] as String? ?? '';
    final readyDlv  = status == 'قيد الانتظار';   // جاهز للتسليم
    final delivered = status == 'تم التسليم';
    final waiting   = status == 'قيد الاستلام';   // ينتظر موافقة CC
    final rejected  = status == 'مرفوضة';
    final hasPhoto  = item['photoBase64'] != null;

    Color statusColor;
    if (delivered)    statusColor = const Color(0xFF81C784);
    else if (readyDlv) statusColor = const Color(0xFF4DD0E1);
    else if (rejected) statusColor = const Color(0xFFEF9A9A);
    else               statusColor = const Color(0xFFFFB74D);

    return Container(
      key: key,
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: isHighlit
            ? const Color(0xFF1A2A1A)
            : const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isHighlit
              ? const Color(0xFF66BB6A).withOpacity(0.8)
              : readyDlv
                  ? const Color(0xFF4DD0E1).withOpacity(0.5)
                  : const Color(0xFF2A2A2A),
          width: isHighlit ? 2 : readyDlv ? 1.5 : 1,
        ),
        boxShadow: isHighlit
            ? [BoxShadow(
                color: const Color(0xFF66BB6A).withOpacity(0.15),
                blurRadius: 12, spreadRadius: 2)]
            : readyDlv
                ? [BoxShadow(
                    color: const Color(0xFF4DD0E1).withOpacity(0.08),
                    blurRadius: 8, spreadRadius: 1)]
                : null,
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
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withOpacity(0.4)),
                  ),
                  child: Text(status,
                      style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.bold)),
                ),
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
                        style: const TextStyle(
                            color: Colors.white54, fontSize: 12)),
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
                style: const TextStyle(
                    color: Colors.white70, fontSize: 13, height: 1.5),
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

          // ── وقت + معلومات التسليم ───────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (delivered && item['dt'] != null)
                  Text('⏱ ${item['dt']}',
                      style: const TextStyle(
                          color: Color(0xFF81C784), fontSize: 11)),
                if (delivered && item['deliveryBranch'] != null)
                  Text(
                    '🔀 سُلِّم لـ: ${item['deliveryBranch']} — ${item['deliveryCity']}',
                    textDirection: TextDirection.rtl,
                    style: const TextStyle(
                        color: Color(0xFF64B5F6), fontSize: 11),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text('🕐 ${item['time'] ?? ''}',
                        style: const TextStyle(
                            color: Colors.white38, fontSize: 11)),
                  ],
                ),
              ],
            ),
          ),

          // ── زر التسليم (قيد الانتظار فقط) ──────────
          if (readyDlv)
            Padding(
              padding: const EdgeInsets.all(14),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.local_shipping_outlined, size: 18),
                  label: const Text('تسليم المنتسية',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2E7D32),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  onPressed: () => _openDeliverDialog(item),
                ),
              ),
            )
          else
            const SizedBox(height: 14),
        ],
      ),
    );
  }

  // ── ملخص الأعداد ────────────────────────────────────────────────────
  Widget _buildSummary() {
    final waiting   = _items.where((x) => x['status'] == 'قيد الاستلام').length;
    final readyDlv  = _items.where((x) => x['status'] == 'قيد الانتظار').length;
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
          _summaryItem('قيد الاستلام',    waiting,   const Color(0xFFFFB74D)),
          _vDivider(),
          _summaryItem('جاهز للتسليم',   readyDlv,  const Color(0xFF4DD0E1)),
          _vDivider(),
          _summaryItem('تم التسليم',     delivered, const Color(0xFF81C784)),
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

  Widget _vDivider() =>
      Container(height: 36, width: 1, color: const Color(0xFF2A2A2A));

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
                    ? ListView(children: const [
                        SizedBox(height: 120),
                        Center(
                          child: Column(children: [
                            Icon(Icons.inbox_outlined,
                                color: Colors.white24, size: 64),
                            SizedBox(height: 16),
                            Text('لم ترسل أي منتسية بعد',
                                style: TextStyle(
                                    color: Colors.white38, fontSize: 16)),
                          ]),
                        ),
                      ])
                    : ListView(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildSummary(),
                          const SizedBox(height: 16),
                          ..._items.map(_card),
                          const SizedBox(height: 20),
                          const Center(
                            child: Text('اسحب للأسفل للتحديث',
                                style: TextStyle(
                                    color: Colors.white24, fontSize: 12)),
                          ),
                        ],
                      ),
              );
  }
}
