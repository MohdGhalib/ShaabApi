import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ManagerAddEmployeeScreen extends StatefulWidget {
  final String token;
  final String name;

  const ManagerAddEmployeeScreen({
    super.key,
    required this.token,
    required this.name,
  });

  @override
  State<ManagerAddEmployeeScreen> createState() => _ManagerAddEmployeeScreenState();
}

class _ManagerAddEmployeeScreenState extends State<ManagerAddEmployeeScreen>
    with AutomaticKeepAliveClientMixin {
  final _nameCtrl  = TextEditingController();
  final _empIdCtrl = TextEditingController();

  // المسميات التي يمكن لمسؤول الكول سنتر إضافتها
  static const _titles = [
    'موظف فرع',
    'موظف كول سنتر',
    'موظف ميديا',
    'مدير قسم السيطرة',
  ];
  String _selectedTitle = 'موظف فرع';
  bool   _loading = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _empIdCtrl.dispose();
    super.dispose();
  }

  /// توليد salt عشوائي 32 حرف hex
  String _generateSalt() {
    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  /// SHA-256 hex كما يفعل الموقع (JavaScript)
  String _sha256Hex(String input) {
    final bytes  = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  Future<void> _addEmployee() async {
    final name  = _nameCtrl.text.trim();
    final empId = _empIdCtrl.text.trim();

    if (name.isEmpty || empId.isEmpty) {
      _snack('يرجى إكمال جميع البيانات', isError: true); return;
    }

    setState(() => _loading = true);

    final emps = await ApiService.fetchEmployeesDb(widget.token);
    if (!mounted) { setState(() => _loading = false); return; }

    if (emps == null) {
      setState(() => _loading = false);
      _snack('تعذّر الاتصال بالسيرفر', isError: true); return;
    }

    // التحقق من عدم تكرار الرقم الوظيفي
    if (emps.any((e) => e['empId'] == empId)) {
      setState(() => _loading = false);
      _snack('الرقم الوظيفي مستخدم مسبقاً', isError: true); return;
    }

    // كلمة المرور الافتراضية = الرقم الوظيفي (SHA-256)
    final salt         = _generateSalt();
    final passwordHash = _sha256Hex(salt + empId);

    final newEmp = {
      'id':           DateTime.now().millisecondsSinceEpoch,
      'name':         name,
      'title':        _selectedTitle,
      'empId':        empId,
      'addedBy':      widget.name,
      'salt':         salt,
      'passwordHash': passwordHash,
    };

    emps.insert(0, newEmp);
    final ok = await ApiService.saveEmployeesDb(widget.token, emps);

    if (!mounted) { setState(() => _loading = false); return; }
    setState(() => _loading = false);

    if (ok) {
      _snack('تم إضافة الموظف بنجاح ✓');
      _nameCtrl.clear();
      _empIdCtrl.clear();
      setState(() => _selectedTitle = 'موظف فرع');
    } else {
      _snack('فشل الحفظ، حاول مرة أخرى', isError: true);
    }
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, textDirection: TextDirection.rtl),
      backgroundColor: isError ? const Color(0xFFB71C1C) : const Color(0xFF2E7D32),
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(children: [
        // بطاقة الإضافة
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E1E),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF2A2A2A)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            const Text('إضافة موظف جديد',
                textAlign: TextAlign.right,
                textDirection: TextDirection.rtl,
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            const Text('كلمة المرور الافتراضية = الرقم الوظيفي',
                textAlign: TextAlign.right,
                textDirection: TextDirection.rtl,
                style: TextStyle(color: Colors.white38, fontSize: 12)),
            const SizedBox(height: 20),

            // اسم الموظف
            _field(
              controller:  _nameCtrl,
              label:       'اسم الموظف',
              icon:        Icons.person_outline,
              inputType:   TextInputType.name,
            ),
            const SizedBox(height: 14),

            // الرقم الوظيفي
            _field(
              controller: _empIdCtrl,
              label:      'الرقم الوظيفي',
              icon:       Icons.badge_outlined,
              inputType:  TextInputType.number,
            ),
            const SizedBox(height: 14),

            // المسمى الوظيفي
            DropdownButtonFormField<String>(
              value: _selectedTitle,
              isExpanded: true,
              dropdownColor: const Color(0xFF252525),
              style: const TextStyle(color: Colors.white, fontSize: 15),
              iconEnabledColor: const Color(0xFFE53935),
              decoration: InputDecoration(
                labelText: 'المسمى الوظيفي',
                labelStyle: const TextStyle(color: Colors.white54),
                prefixIcon: const Icon(Icons.work_outline, color: Color(0xFFE53935)),
                filled: true, fillColor: const Color(0xFF252525),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFE53935), width: 1.5)),
              ),
              items: _titles.map((t) => DropdownMenuItem(
                value: t,
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(t, textDirection: TextDirection.rtl),
                ),
              )).toList(),
              onChanged: (v) => setState(() => _selectedTitle = v ?? 'موظف فرع'),
            ),

            const SizedBox(height: 24),

            // زر الإضافة
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                icon: _loading
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                    : const Icon(Icons.person_add_alt_1),
                label: Text(_loading ? 'جارٍ الحفظ...' : 'إضافة الموظف',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE53935),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                onPressed: _loading ? null : _addEmployee,
              ),
            ),
          ]),
        ),

        const SizedBox(height: 16),

        // ملاحظة
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0x11E53935),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0x33E53935)),
          ),
          child: const Text(
            '• موظف الفرع: يمكنه الدخول للتطبيق وإرسال المنتسيات فقط\n'
            '• كلمة المرور الافتراضية هي الرقم الوظيفي، يمكن تغييرها من الموقع',
            textAlign: TextAlign.right,
            textDirection: TextDirection.rtl,
            style: TextStyle(color: Colors.white54, fontSize: 12, height: 1.7),
          ),
        ),
      ]),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType inputType = TextInputType.text,
  }) =>
      TextFormField(
        controller:    controller,
        keyboardType:  inputType,
        textAlign:     TextAlign.right,
        textDirection: TextDirection.rtl,
        style: const TextStyle(color: Colors.white, fontSize: 15),
        decoration: InputDecoration(
          labelText:  label,
          labelStyle: const TextStyle(color: Colors.white54),
          prefixIcon: Icon(icon, color: const Color(0xFFE53935)),
          filled:    true,
          fillColor: const Color(0xFF252525),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE53935), width: 1.5)),
        ),
      );
}
