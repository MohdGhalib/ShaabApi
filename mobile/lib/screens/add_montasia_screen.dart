import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import '../constants.dart';
import '../services/api_service.dart';

class AddMontasiaTab extends StatefulWidget {
  final String token;
  final String name;
  final String title;
  final String role;
  final String empId;

  const AddMontasiaTab({
    super.key,
    required this.token,
    required this.name,
    required this.title,
    required this.role,
    this.empId = '',
  });

  @override
  State<AddMontasiaTab> createState() => _AddMontasiaTabState();
}

class _AddMontasiaTabState extends State<AddMontasiaTab> {
  String?  _city;
  String?  _branch;
  String?  _type;
  final _notesCtrl = TextEditingController();
  File?    _photo;
  bool     _submitting = false;
  String?  _successMsg;

  /// الفروع المخصصة لهذا الموظف (فارغة = كل الفروع)
  List<String> _assignedBranches = [];

  @override
  void initState() {
    super.initState();
    if (widget.empId.isNotEmpty) _loadAssigned();
  }

  Future<void> _loadAssigned() async {
    final emps = await ApiService.fetchEmployeesDb(widget.token);
    if (emps == null || !mounted) return;
    final emp = emps
        .where((e) => e['empId']?.toString() == widget.empId)
        .firstOrNull;
    if (emp == null) return;

    List<String> branches = [];

    // assignedBranches → قائمة objects كل منها { city, branch }
    final multi = emp['assignedBranches'];
    if (multi is List && multi.isNotEmpty) {
      branches = multi
          .map((e) => (e as Map<String, dynamic>)['branch']?.toString() ?? '')
          .where((b) => b.isNotEmpty)
          .toList();
    }

    // assignedBranch → object { city, branch }
    if (branches.isEmpty) {
      final single = emp['assignedBranch'];
      if (single is Map) {
        final b = single['branch']?.toString() ?? '';
        if (b.isNotEmpty) branches = [b];
      }
    }

    if (!mounted) return;
    setState(() {
      _assignedBranches = branches;
      // اختيار تلقائي إذا كان فرع واحد فقط
      if (branches.length == 1) {
        _branch = branches.first;
        _city   = _findCity(branches.first);
      }
    });
  }

  /// ابحث عن المحافظة التي ينتمي إليها الفرع
  String? _findCity(String branch) {
    for (final entry in kBranches.entries) {
      if (entry.value.contains(branch)) return entry.key;
    }
    return null;
  }

  /// المحافظات المتاحة (مصفّاة حسب الفروع المخصصة)
  List<String> get _allowedCities {
    if (_assignedBranches.isEmpty) return kBranches.keys.toList();
    return kBranches.keys.where((city) =>
      (kBranches[city] ?? []).any((b) => _assignedBranches.contains(b))
    ).toList();
  }

  /// الفروع المتاحة للمحافظة المختارة (مصفّاة حسب الفروع المخصصة)
  List<String> get _branches {
    if (_city == null) return [];
    final all = kBranches[_city] ?? [];
    if (_assignedBranches.isEmpty) return all;
    return all.where((b) => _assignedBranches.contains(b)).toList();
  }

  Future<void> _pickPhoto() async {
    final xfile = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 80,
      maxWidth: 1280,
      maxHeight: 1280,
    );
    if (xfile == null) return;
    setState(() => _photo = File(xfile.path));
  }

  void _removePhoto() => setState(() => _photo = null);

  Future<String?> _compressAndEncode(File file) async {
    final compressed = await FlutterImageCompress.compressWithFile(
      file.absolute.path,
      quality: 60,
      minWidth: 800,
      minHeight: 800,
    );
    if (compressed == null) return null;
    return base64Encode(compressed);
  }

  String _formatTime() {
    final n = DateTime.now();
    return '${n.hour.toString().padLeft(2,'0')}:${n.minute.toString().padLeft(2,'0')}'
        ' | ${n.day.toString().padLeft(2,'0')}/${n.month.toString().padLeft(2,'0')}/${n.year}';
  }

  Future<void> _submit() async {
    if (_city == null)   { _err('اختر المحافظة'); return; }
    if (_branch == null) { _err('اختر الفرع');    return; }
    if (_type == null)   { _err('اختر النوع');    return; }
    final notes = _notesCtrl.text.trim();
    if (notes.isEmpty)   { _err('أدخل التفاصيل'); return; }

    setState(() { _submitting = true; _successMsg = null; });

    final db = await ApiService.fetchMasterDb(widget.token);
    if (db == null) {
      setState(() => _submitting = false);
      _err('تعذّر الاتصال بالسيرفر');
      return;
    }

    String? photoBase64;
    if (_photo != null) photoBase64 = await _compressAndEncode(_photo!);

    final montasia = <String, dynamic>{
      'id':          DateTime.now().millisecondsSinceEpoch,
      'city':        _city,
      'branch':      _branch,
      'notes':       notes,
      'type':        _type,
      'time':        _formatTime(),
      'iso':         DateTime.now().toIso8601String(),
      'status':      'قيد الاستلام',
      'dt':          '',
      'addedBy':     widget.name,
      'empId':       widget.empId,
      'deliveredBy': '',
      'source':      'mobile',
      if (photoBase64 != null) 'photoBase64': photoBase64,
    };

    final list = (db['montasiat'] as List? ?? []);
    list.insert(0, montasia);
    db['montasiat'] = list;

    final ok = await ApiService.saveMasterDb(widget.token, db);
    if (!mounted) return;
    setState(() => _submitting = false);

    if (ok) {
      setState(() {
        _city = null; _branch = null; _type = null; _photo = null;
        _successMsg = 'تم الإرسال بنجاح ✓\nستصل للكول سنتر قيد الاستلام';
      });
      _notesCtrl.clear();
    } else {
      _err('فشل الحفظ، حاول مرة أخرى');
    }
  }

  void _err(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, textDirection: TextDirection.rtl),
      backgroundColor: const Color(0xFFB71C1C),
      behavior: SnackBarBehavior.floating,
    ));
  }

  Widget _dropdown({
    required String label,
    required String? value,
    required List<String> items,
    void Function(String?)? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(label,
            textDirection: TextDirection.rtl,
            style: const TextStyle(color: Colors.white70, fontSize: 13)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: value,
          isExpanded: true,
          dropdownColor: const Color(0xFF252525),
          style: const TextStyle(color: Colors.white, fontSize: 15),
          iconEnabledColor: const Color(0xFFE53935),
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF252525),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE53935), width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          ),
          hint: Text('اختر $label',
              textDirection: TextDirection.rtl,
              style: const TextStyle(color: Colors.white38)),
          items: items
              .map((e) => DropdownMenuItem(
                    value: e,
                    child: Text(e, textDirection: TextDirection.rtl),
                  ))
              .toList(),
          onChanged: onChanged,
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [

          if (_successMsg != null)
            Container(
              margin: const EdgeInsets.only(bottom: 20),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1B5E20).withOpacity(0.3),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF388E3C)),
              ),
              child: Text(
                _successMsg!,
                textAlign: TextAlign.center,
                textDirection: TextDirection.rtl,
                style: const TextStyle(
                  color: Color(0xFF81C784), fontSize: 15,
                  fontWeight: FontWeight.w600, height: 1.6,
                ),
              ),
            ),

          _dropdown(
            label: 'المحافظة', value: _city,
            items: _allowedCities,
            onChanged: _assignedBranches.length == 1
                ? null  // فرع واحد محدد → المحافظة ثابتة
                : (v) => setState(() { _city = v; _branch = null; }),
          ),

          _dropdown(
            label: 'الفرع', value: _branch, items: _branches,
            onChanged: (_city == null || _assignedBranches.length == 1)
                ? null  // فرع واحد محدد → الفرع ثابت
                : (v) => setState(() => _branch = v),
          ),

          _dropdown(
            label: 'النوع', value: _type, items: kTypes,
            onChanged: (v) => setState(() => _type = v),
          ),

          Align(
            alignment: Alignment.centerRight,
            child: const Text('التفاصيل',
                textDirection: TextDirection.rtl,
                style: TextStyle(color: Colors.white70, fontSize: 13)),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _notesCtrl,
            minLines: 4, maxLines: 6,
            textAlign: TextAlign.right,
            textDirection: TextDirection.rtl,
            style: const TextStyle(color: Colors.white, fontSize: 15),
            decoration: InputDecoration(
              hintText: 'اكتب تفاصيل المنتسية...',
              hintStyle: const TextStyle(color: Colors.white30),
              filled: true, fillColor: const Color(0xFF252525),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE53935), width: 1.5)),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),

          const SizedBox(height: 20),

          _photo == null
              ? OutlinedButton.icon(
                  icon: const Icon(Icons.camera_alt, color: Color(0xFFE53935)),
                  label: const Text('تصوير المنتسية',
                      style: TextStyle(color: Color(0xFFE53935), fontSize: 15)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: Color(0xFFE53935)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _pickPhoto,
                )
              : Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(_photo!,
                          width: double.infinity, height: 200, fit: BoxFit.cover),
                    ),
                    Positioned(
                      top: 8, left: 8,
                      child: GestureDetector(
                        onTap: _removePhoto,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                              color: Colors.black54,
                              borderRadius: BorderRadius.circular(20)),
                          child: const Icon(Icons.close, color: Colors.white, size: 18),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 8, right: 8,
                      child: GestureDetector(
                        onTap: _pickPhoto,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                              color: const Color(0xFFE53935),
                              borderRadius: BorderRadius.circular(10)),
                          child: const Text('إعادة التصوير',
                              style: TextStyle(color: Colors.white, fontSize: 12)),
                        ),
                      ),
                    ),
                  ],
                ),

          const SizedBox(height: 28),

          SizedBox(
            height: 54,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE53935),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: _submitting
                  ? const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2.5)),
                        SizedBox(width: 12),
                        Text('جاري الإرسال...', style: TextStyle(fontSize: 16)),
                      ],
                    )
                  : const Text('إرسال المنتسية',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            ),
          ),

          const SizedBox(height: 30),
        ],
      ),
    );
  }
}
