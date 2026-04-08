import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// شاشة الشكاوى لمدير الفرع ومدير المنطقة
/// — عرض منسّق (نسخة مدراء الأفرع) + إمكانية تسجيل حل المشكلة
class BranchComplaintsScreen extends StatefulWidget {
  final String token;
  final String name;
  final String role;
  final String empId;
  final ValueNotifier<int> refreshTrigger;

  const BranchComplaintsScreen({
    super.key,
    required this.token,
    required this.name,
    required this.role,
    this.empId = '',
    required this.refreshTrigger,
  });

  @override
  State<BranchComplaintsScreen> createState() => _BranchComplaintsScreenState();
}

class _BranchComplaintsScreenState extends State<BranchComplaintsScreen>
    with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> _items = [];
  bool    _loading = false;
  String? _error;
  String  _search  = '';

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

    // قراءة الفروع المخصصة للموظف
    List<String> assignedBranches = [];
    if (widget.empId.isNotEmpty) {
      final emps = await ApiService.fetchEmployeesDb(widget.token);
      if (emps != null) {
        final emp = emps.where((e) => e['empId']?.toString() == widget.empId).firstOrNull;
        if (emp != null) {
          final single = emp['assignedBranch']?.toString();
          final multi  = (emp['assignedBranches'] as List?)?.map((e) => e.toString()).toList();
          if (multi != null && multi.isNotEmpty) {
            assignedBranches = multi;
          } else if (single != null && single.isNotEmpty) {
            assignedBranches = [single];
          }
        }
      }
    }

    final db = await ApiService.fetchMasterDb(widget.token);
    if (!mounted) return;
    if (db == null) {
      setState(() { _loading = false; _error = 'تعذّر الاتصال بالسيرفر'; });
      return;
    }
    // مدير الفرع/المنطقة يرى الشكاوى التي لها رد من قسم السيطرة فقط
    // مع فلترة حسب الفروع المخصصة له
    final all = (db['complaints'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((x) {
          if (x['deleted'] == true) return false;
          if ((x['audit'] as String? ?? '').isEmpty) return false;
          if (assignedBranches.isNotEmpty) {
            return assignedBranches.contains(x['branch']?.toString());
          }
          return true;
        })
        .toList();
    setState(() { _items = all; _loading = false; });
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.isEmpty) return _items;
    final q = _search.toLowerCase();
    return _items.where((x) {
      final branch = (x['branch'] ?? '').toString().toLowerCase();
      final city   = (x['city']   ?? '').toString().toLowerCase();
      final notes  = (x['notes']  ?? '').toString().toLowerCase();
      return branch.contains(q) || city.contains(q) || notes.contains(q);
    }).toList();
  }

  Future<void> _saveResolution(Map<String, dynamic> item, String text) async {
    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null || !mounted) return;
    final list = (db['complaints'] as List? ?? []).cast<Map<String, dynamic>>();
    final idx = list.indexWhere((c) => c['id'] == item['id']);
    if (idx == -1) return;
    list[idx]['branchResolution']   = text.trim();
    list[idx]['branchResolvedBy']   = widget.name;
    list[idx]['branchResolvedAt']   = DateTime.now().toIso8601String();
    db['complaints'] = list;
    await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;
    _load();
  }

  void _showResolveDialog(Map<String, dynamic> item) {
    final ctrl = TextEditingController(text: item['branchResolution'] as String? ?? '');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('تسجيل حل المشكلة',
            textDirection: TextDirection.rtl,
            style: TextStyle(color: Colors.white, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: ctrl,
              maxLines: 4,
              textDirection: TextDirection.rtl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'اكتب وصف الحل (اختياري)...',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF252525),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('إلغاء', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2E7D32)),
            onPressed: () async {
              Navigator.pop(context);
              await _saveResolution(item, ctrl.text);
            },
            child: const Text('تم حل المشكلة ✅',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildComplaintCard(Map<String, dynamic> item) {
    final branch     = item['branch']          as String? ?? '';
    final city       = item['city']            as String? ?? '';
    final notes      = item['notes']           as String? ?? '';
    final audit      = item['audit']           as String? ?? '';
    final followup   = item['followupResult']  as String? ?? '';
    final auditStatus= item['auditStatus']     as String? ?? '';
    final noteDate   = item['noteDate']        as String? ?? '';
    final time       = item['time']            as String? ?? '';
    final addedBy    = item['addedBy']         as String? ?? '';
    final resolution = item['branchResolution']as String? ?? '';
    final resolvedBy = item['branchResolvedBy']as String? ?? '';
    final isResolved = resolution.isNotEmpty || resolvedBy.isNotEmpty;

    Color auditColor = const Color(0xFF90CAF9);
    if (auditStatus == 'مكتوبة')      auditColor = const Color(0xFF81C784);
    if (auditStatus == 'غير مكتوبة') auditColor = const Color(0xFFEF9A9A);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isResolved
              ? const Color(0xFF2E7D32).withOpacity(0.5)
              : const Color(0xFF2A2A2A),
          width: isResolved ? 1.5 : 1,
        ),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // ── رأس البطاقة ──
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: const BoxDecoration(
            color: Color(0xFF252525),
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('🕐 $time',
                  style: const TextStyle(color: Colors.white38, fontSize: 11)),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(branch,
                    textDirection: TextDirection.rtl,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15)),
                Text(city,
                    textDirection: TextDirection.rtl,
                    style: const TextStyle(color: Colors.white54, fontSize: 12)),
              ]),
            ],
          ),
        ),

        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            if (noteDate.isNotEmpty) ...[
              _infoRow('📅 تاريخ الملاحظة', noteDate),
              const SizedBox(height: 8),
            ],

            // ── نص الشكوى ──
            _section(
              label: '📋 نص الشكوى',
              labelColor: const Color(0xFFE53935),
              borderColor: const Color(0xFFE53935),
              bgColor: const Color(0xFFE53935).withOpacity(0.06),
              content: notes,
            ),
            const SizedBox(height: 10),

            // ── رد قسم السيطرة ──
            if (audit.isNotEmpty) ...[
              _section(
                label: '💬 نتيجة التدقيق من قسم السيطرة',
                labelColor: const Color(0xFF90CAF9),
                borderColor: const Color(0xFF1565C0),
                bgColor: const Color(0xFF1565C0).withOpacity(0.06),
                content: audit,
                trailing: auditStatus.isNotEmpty
                    ? Container(
                        margin: const EdgeInsets.only(top: 8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: auditColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: auditColor.withOpacity(0.4)),
                        ),
                        child: Text(auditStatus,
                            textDirection: TextDirection.rtl,
                            style: TextStyle(
                                color: auditColor,
                                fontSize: 11,
                                fontWeight: FontWeight.bold)),
                      )
                    : null,
              ),
              const SizedBox(height: 10),
            ],

            // ── نتيجة المتابعة ──
            if (followup.isNotEmpty) ...[
              _section(
                label: '📞 إجراءات مستلم الشكوى',
                labelColor: const Color(0xFF81C784),
                borderColor: const Color(0xFF2E7D32),
                bgColor: const Color(0xFF2E7D32).withOpacity(0.06),
                content: followup,
              ),
              const SizedBox(height: 10),
            ],

            // ── حل المشكلة ──
            if (isResolved) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF2E7D32).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: const Color(0xFF2E7D32).withOpacity(0.4)),
                ),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                  const Text('✅ تم حل المشكلة',
                      textDirection: TextDirection.rtl,
                      style: TextStyle(
                          color: Color(0xFF81C784),
                          fontWeight: FontWeight.bold,
                          fontSize: 13)),
                  if (resolution.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(resolution,
                        textDirection: TextDirection.rtl,
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 13)),
                  ],
                  if (resolvedBy.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text('👤 $resolvedBy',
                        textDirection: TextDirection.rtl,
                        style: const TextStyle(
                            color: Colors.white38, fontSize: 11)),
                  ],
                ]),
              ),
              const SizedBox(height: 10),
            ],

            // ── زر تسجيل الحل ──
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                SizedBox(
                  height: 36,
                  child: OutlinedButton.icon(
                    icon: Icon(
                        isResolved ? Icons.edit_outlined : Icons.check_circle_outline,
                        size: 16,
                        color: isResolved
                            ? Colors.white38
                            : const Color(0xFF81C784)),
                    label: Text(
                        isResolved ? 'تعديل الحل' : 'تم حل المشكلة',
                        style: TextStyle(
                            fontSize: 12,
                            color: isResolved
                                ? Colors.white38
                                : const Color(0xFF81C784))),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(
                          color: isResolved
                              ? Colors.white24
                              : const Color(0xFF2E7D32).withOpacity(0.6)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 0),
                    ),
                    onPressed: () => _showResolveDialog(item),
                  ),
                ),
                Text('📥 $addedBy',
                    textDirection: TextDirection.rtl,
                    style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _section({
    required String label,
    required Color labelColor,
    required Color borderColor,
    required Color bgColor,
    required String content,
    Widget? trailing,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border(right: BorderSide(color: borderColor, width: 3)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Text(label,
            textDirection: TextDirection.rtl,
            style: TextStyle(
                color: labelColor,
                fontWeight: FontWeight.bold,
                fontSize: 12)),
        const SizedBox(height: 6),
        Text(content,
            textDirection: TextDirection.rtl,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                height: 1.5)),
        if (trailing != null) trailing,
      ]),
    );
  }

  Widget _infoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text(value,
            style: const TextStyle(color: Colors.white70, fontSize: 12)),
        const SizedBox(width: 6),
        Text(label,
            style: const TextStyle(color: Colors.white38, fontSize: 12)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: Color(0xFFE53935)));
    }
    if (_error != null) {
      return Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(_error!, style: const TextStyle(color: Colors.white54)),
        const SizedBox(height: 16),
        ElevatedButton(
            onPressed: _load,
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE53935)),
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
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: 'بحث بالفرع أو المحافظة أو الشكوى...',
            hintStyle: const TextStyle(color: Colors.white38, fontSize: 13),
            prefixIcon: const Icon(Icons.search, color: Colors.white38),
            suffixIcon: _search.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close, color: Colors.white38, size: 18),
                    onPressed: () => setState(() => _search = ''),
                  )
                : null,
            filled: true,
            fillColor: const Color(0xFF1E1E1E),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                    color: Color(0xFFE53935), width: 1)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),

      // ملخص
      if (_items.isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A1A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF2A2A2A)),
            ),
            child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
              _stat('${_items.length}', 'إجمالي', Colors.white60),
              _divider(),
              _stat(
                  '${_items.where((x) => (x['branchResolution'] as String? ?? '').isNotEmpty || (x['branchResolvedBy'] as String? ?? '').isNotEmpty).length}',
                  'تم الحل',
                  const Color(0xFF81C784)),
              _divider(),
              _stat(
                  '${_items.where((x) => (x['branchResolution'] as String? ?? '').isEmpty && (x['branchResolvedBy'] as String? ?? '').isEmpty).length}',
                  'قيد المتابعة',
                  const Color(0xFFFFB74D)),
            ]),
          ),
        ),

      Expanded(
        child: RefreshIndicator(
          onRefresh: _load,
          color: const Color(0xFFE53935),
          backgroundColor: const Color(0xFF1E1E1E),
          child: shown.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 100),
                  Center(
                      child: Column(children: [
                    Icon(Icons.security_outlined,
                        color: Colors.white24, size: 56),
                    SizedBox(height: 12),
                    Text('لا توجد شكاوى معالجة',
                        style: TextStyle(color: Colors.white38)),
                  ])),
                ])
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 20),
                  itemCount: shown.length,
                  itemBuilder: (_, i) => _buildComplaintCard(shown[i]),
                ),
        ),
      ),
    ]);
  }

  Widget _stat(String v, String l, Color c) => Column(children: [
        Text(v,
            style: TextStyle(
                color: c, fontSize: 16, fontWeight: FontWeight.bold)),
        Text(l,
            style: const TextStyle(color: Colors.white38, fontSize: 9)),
      ]);

  Widget _divider() =>
      Container(height: 26, width: 1, color: const Color(0xFF2A2A2A));
}
