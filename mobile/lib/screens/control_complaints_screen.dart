import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// شاشة الشكاوى لأدوار قسم السيطرة
/// control_employee: رد مباشر + موافقة على ردود الموظفين
/// control_sub:      كتابة رد ينتظر موافقة المدير
class ControlComplaintsScreen extends StatefulWidget {
  final String token;
  final String name;
  final String role;
  final ValueNotifier<int> refreshTrigger;

  const ControlComplaintsScreen({
    super.key,
    required this.token,
    required this.name,
    required this.role,
    required this.refreshTrigger,
  });

  @override
  State<ControlComplaintsScreen> createState() => _ControlComplaintsScreenState();
}

class _ControlComplaintsScreenState extends State<ControlComplaintsScreen>
    with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> _items = [];
  bool    _loading = false;
  String? _error;

  bool get _isManager => widget.role == 'control_employee';

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
    var all = (db['complaints'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((x) => x['deleted'] != true)
        .toList();

    // موظف السيطرة يرى فقط الشكاوى التي تمت موافقتها
    if (!_isManager) {
      all = all.where((x) => x['status'] == 'تمت الموافقة').toList();
    }

    setState(() { _items = all; _loading = false; });
  }

  // ── رد مدير قسم السيطرة المباشر ────────────────────────────────────
  Future<void> _showManagerReplyDialog(Map<String, dynamic> item) async {
    final ctrl      = TextEditingController();
    String? auditStatus;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            backgroundColor: const Color(0xFF1E1E1E),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('رد قسم السيطرة',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            content: Column(mainAxisSize: MainAxisSize.min, children: [
              // معلومات الشكوى
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                    color: const Color(0xFF252525), borderRadius: BorderRadius.circular(8)),
                child: Text(
                  '${item['branch']} — ${item['city']}\n${(item['notes'] as String? ?? '').substring(0, (item['notes'] as String? ?? '').length.clamp(0, 80))}',
                  textDirection: TextDirection.rtl, textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
              const SizedBox(height: 12),

              // حالة الملاحظة
              DropdownButtonFormField<String>(
                value: auditStatus,
                isExpanded: true,
                dropdownColor: const Color(0xFF252525),
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'حالة الملاحظة *',
                  labelStyle: const TextStyle(color: Colors.white54),
                  filled: true, fillColor: const Color(0xFF252525),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                hint: const Text('اختر الحالة', style: TextStyle(color: Colors.white38)),
                items: const [
                  DropdownMenuItem(value: 'مكتوبة',     child: Text('مكتوبة')),
                  DropdownMenuItem(value: 'غير مكتوبة', child: Text('غير مكتوبة')),
                ],
                onChanged: (v) => setDlg(() => auditStatus = v),
              ),
              const SizedBox(height: 10),

              // نص الرد
              TextField(
                controller:    ctrl,
                maxLines:      4,
                textDirection: TextDirection.rtl,
                textAlign:     TextAlign.right,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText:  'اكتب الرد هنا...',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled:    true, fillColor: const Color(0xFF252525),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.all(12),
                ),
              ),
            ]),
            actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('إلغاء', style: TextStyle(color: Colors.white54)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1565C0), foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  if (auditStatus == null) {
                    _snack('يرجى اختيار حالة الملاحظة', isError: true); return;
                  }
                  if (ctrl.text.trim().isEmpty) {
                    _snack('يرجى كتابة الرد', isError: true); return;
                  }
                  Navigator.pop(ctx, true);
                },
                child: const Text('حفظ الرد', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true) return;
    if (ctrl.text.trim().isEmpty || auditStatus == null) return;

    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) { _snack('تعذّر الاتصال', isError: true); return; }
    final list = (db['complaints'] as List).cast<Map<String, dynamic>>();
    final idx  = list.indexWhere((x) => x['id'] == item['id']);
    if (idx == -1) return;

    final now = _nowStr();
    list[idx]['audit']       = ctrl.text.trim();
    list[idx]['auditStatus'] = auditStatus;
    list[idx]['auditBy']     = widget.name;
    list[idx]['auditTime']   = now;
    db['complaints'] = list;

    final ok = await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;
    ok ? _snack('تم حفظ الرد ✓') : _snack('فشل الحفظ', isError: true);
    _load();
  }

  // ── موافقة مدير السيطرة على رد الموظف ──────────────────────────────
  Future<void> _showApproveSubReplyDialog(Map<String, dynamic> item) async {
    String? auditStatus;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            backgroundColor: const Color(0xFF1E1E1E),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('اعتماد رد الموظف',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            content: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                    color: const Color(0xFF1A3A5C), borderRadius: BorderRadius.circular(8)),
                child: Text(
                  'رد الموظف:\n${item['controlEmpReply'] ?? ''}',
                  textDirection: TextDirection.rtl, textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: auditStatus,
                isExpanded: true,
                dropdownColor: const Color(0xFF252525),
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'حالة الملاحظة *',
                  labelStyle: const TextStyle(color: Colors.white54),
                  filled: true, fillColor: const Color(0xFF252525),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                hint: const Text('اختر الحالة', style: TextStyle(color: Colors.white38)),
                items: const [
                  DropdownMenuItem(value: 'مكتوبة',     child: Text('مكتوبة')),
                  DropdownMenuItem(value: 'غير مكتوبة', child: Text('غير مكتوبة')),
                ],
                onChanged: (v) => setDlg(() => auditStatus = v),
              ),
            ]),
            actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('إلغاء', style: TextStyle(color: Colors.white54)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  if (auditStatus == null) {
                    _snack('يرجى اختيار حالة الملاحظة', isError: true); return;
                  }
                  Navigator.pop(ctx, true);
                },
                child: const Text('اعتماد الرد', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true || auditStatus == null) return;

    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) { _snack('تعذّر الاتصال', isError: true); return; }
    final list = (db['complaints'] as List).cast<Map<String, dynamic>>();
    final idx  = list.indexWhere((x) => x['id'] == item['id']);
    if (idx == -1) return;

    list[idx]['audit']                   = item['controlEmpReply'];
    list[idx]['auditStatus']             = auditStatus;
    list[idx]['auditBy']                 = widget.name;
    list[idx]['auditTime']               = _nowStr();
    list[idx]['controlEmpReplyApproved'] = true;
    db['complaints'] = list;

    final ok = await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;
    ok ? _snack('تم اعتماد الرد ✓') : _snack('فشل الحفظ', isError: true);
    _load();
  }

  // ── رد موظف السيطرة ─────────────────────────────────────────────────
  Future<void> _showSubReplyDialog(Map<String, dynamic> item) async {
    final ctrl = TextEditingController(
        text: item['controlEmpReply'] as String? ?? '');

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('كتابة الرد',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                  color: const Color(0xFF252525), borderRadius: BorderRadius.circular(8)),
              child: Text(
                '${item['branch']} — ${item['city']}',
                textDirection: TextDirection.rtl, textAlign: TextAlign.right,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'سيُرسل ردك لمدير القسم للاعتماد',
              textDirection: TextDirection.rtl, textAlign: TextAlign.right,
              style: TextStyle(color: Colors.white38, fontSize: 12),
            ),
            const SizedBox(height: 8),
            TextField(
              controller:    ctrl,
              maxLines:      4,
              textDirection: TextDirection.rtl,
              textAlign:     TextAlign.right,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText:  'اكتب الرد هنا...',
                hintStyle: const TextStyle(color: Colors.white38),
                filled:    true, fillColor: const Color(0xFF252525),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ]),
          actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6A1B9A), foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('إرسال', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true) return;
    if (ctrl.text.trim().isEmpty) { _snack('يرجى كتابة الرد', isError: true); return; }

    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) { _snack('تعذّر الاتصال', isError: true); return; }
    final list = (db['complaints'] as List).cast<Map<String, dynamic>>();
    final idx  = list.indexWhere((x) => x['id'] == item['id']);
    if (idx == -1) return;

    list[idx]['controlEmpReply']     = ctrl.text.trim();
    list[idx]['controlEmpReplyBy']   = widget.name;
    list[idx]['controlEmpReplyTime'] = _nowStr();
    db['complaints'] = list;

    final ok = await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;
    ok ? _snack('تم إرسال الرد بنتظار الاعتماد ✓') : _snack('فشل الحفظ', isError: true);
    _load();
  }

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

  Color _statusColor(String status) {
    switch (status) {
      case 'تمت الموافقة':    return const Color(0xFF81C784);
      case 'بانتظار الموافقة': return const Color(0xFFFFB74D);
      default:                 return Colors.white54;
    }
  }

  Color _auditStatusColor(String s) {
    if (s == 'مكتوبة')     return const Color(0xFF81C784);
    if (s == 'غير مكتوبة') return const Color(0xFFEF9A9A);
    return const Color(0xFF90CAF9);
  }

  Widget _card(Map<String, dynamic> item) {
    final status       = item['status']       as String? ?? '';
    final branch       = item['branch']       as String? ?? '';
    final city         = item['city']         as String? ?? '';
    final notes        = item['notes']        as String? ?? '';
    final time         = item['time']         as String? ?? '';
    final addedBy      = item['addedBy']      as String? ?? '';
    final audit        = item['audit']        as String? ?? '';
    final auditStatus  = item['auditStatus']  as String? ?? '';
    final auditBy      = item['auditBy']      as String? ?? '';
    final subReply     = item['controlEmpReply']    as String? ?? '';
    final subApproved  = item['controlEmpReplyApproved'] == true;
    final sc           = _statusColor(status);
    final hasAudit     = audit.isNotEmpty;
    final hasSubReply  = subReply.isNotEmpty && !subApproved;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: hasSubReply
              ? const Color(0xFF9C27B0).withOpacity(0.5)
              : status == 'بانتظار الموافقة'
                  ? const Color(0xFFFFB74D).withOpacity(0.4)
                  : const Color(0xFF2A2A2A),
          width: hasSubReply ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          // الرأس
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            _badge(status, sc),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('$branch — $city',
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
            ]),
          ]),

          if (notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(notes,
                textAlign: TextAlign.right, textDirection: TextDirection.rtl,
                maxLines: 3, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4)),
          ],

          // رد موجود
          if (hasAudit) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF1A3A1A), borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF2E7D32).withOpacity(0.4)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  if (auditStatus.isNotEmpty)
                    _badge(auditStatus, _auditStatusColor(auditStatus)),
                  Text('💬 رد قسم السيطرة',
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(
                          color: Color(0xFF81C784), fontSize: 11, fontWeight: FontWeight.bold)),
                ]),
                const SizedBox(height: 4),
                Text(audit,
                    textDirection: TextDirection.rtl, textAlign: TextAlign.right,
                    style: const TextStyle(color: Colors.white, fontSize: 13)),
                if (auditBy.isNotEmpty)
                  Text('بواسطة: $auditBy',
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ]),
            ),
          ],

          // رد موظف السيطرة ينتظر اعتماد المدير
          if (hasSubReply && _isManager) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF2A1A3A), borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF9C27B0).withOpacity(0.4)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                const Text('⏳ رد الموظف — بانتظار الاعتماد',
                    textDirection: TextDirection.rtl,
                    style: TextStyle(color: Color(0xFFCE93D8), fontSize: 11, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(subReply,
                    textDirection: TextDirection.rtl, textAlign: TextAlign.right,
                    style: const TextStyle(color: Colors.white, fontSize: 13)),
              ]),
            ),
          ],

          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('🕐 $time', style: const TextStyle(color: Colors.white38, fontSize: 11)),
            Text('👤 $addedBy',
                textDirection: TextDirection.rtl,
                style: const TextStyle(color: Colors.white38, fontSize: 11)),
          ]),

          // أزرار الإجراءات
          const SizedBox(height: 10),
          if (_isManager) ...[
            // مدير قسم السيطرة
            Row(children: [
              if (!hasAudit) ...[
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.edit_outlined, size: 15, color: Color(0xFF64B5F6)),
                    label: const Text('رد مباشر',
                        style: TextStyle(color: Color(0xFF64B5F6), fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0x554DB6AC)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onPressed: () => _showManagerReplyDialog(item),
                  ),
                ),
              ] else ...[
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.edit, size: 15, color: Colors.white54),
                    label: const Text('تعديل الرد',
                        style: TextStyle(color: Colors.white54, fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF333333)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onPressed: () => _showManagerReplyDialog(item),
                  ),
                ),
              ],
              if (hasSubReply) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.check_circle_outline, size: 15),
                    label: const Text('اعتماد رد الموظف',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6A1B9A), foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0, padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onPressed: () => _showApproveSubReplyDialog(item),
                  ),
                ),
              ],
            ]),
          ] else ...[
            // موظف السيطرة
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.edit_outlined, size: 15),
                label: Text(
                  subReply.isNotEmpty ? 'تعديل الرد' : 'كتابة رد',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6A1B9A), foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  elevation: 0, padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onPressed: () => _showSubReplyDialog(item),
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

  Widget _buildSummary() {
    final approved = _items.where((x) => x['status'] == 'تمت الموافقة').length;
    final replied  = _items.where((x) => (x['audit'] as String? ?? '').isNotEmpty).length;
    final pending  = _items.where((x) =>
        (x['controlEmpReply'] as String? ?? '').isNotEmpty &&
        x['controlEmpReplyApproved'] != true).length;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A), borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
        _si('${_items.length}', 'الكل',     Colors.white60),
        _div(),
        _si('$approved',        'موافقة',   const Color(0xFF81C784)),
        _div(),
        _si('$replied',         'تم الرد',  const Color(0xFF4DD0E1)),
        if (_isManager) ...[
          _div(),
          _si('$pending', 'بانتظار اعتماد', const Color(0xFFCE93D8)),
        ],
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
