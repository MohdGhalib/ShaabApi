import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
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

class _AddMontasiaTabState extends State<AddMontasiaTab>
    with SingleTickerProviderStateMixin {
  String?  _city;
  String?  _branch;
  String?  _type;
  final _notesCtrl = TextEditingController();
  File?    _photo;
  bool     _submitting = false;

  List<String> _assignedBranches = [];

  // ── التعرف على الصوت ──────────────────────────────────
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _speechEnabled = false;

  // ── حالة التسجيل الإنلاين ──────────────────────────────
  late final AnimationController _waveController;
  bool      _isRecording   = false;
  DateTime? _recordingStart;

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _initSpeech();
    if (widget.empId.isNotEmpty) _loadAssigned();
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    _waveController.dispose();
    _speech.cancel();
    super.dispose();
  }

  Future<void> _initSpeech() async {
    _speechEnabled = await _speech.initialize(
      onError: (e) {
        // خطأ في التعرف → أوقف الـ UI بهدوء
        if (mounted && _isRecording) _stopRecording();
      },
      onStatus: (s) {
        // 'done' فقط تعني أن المحرك أنهى الاستماع تلقائياً
        if (s == 'done' && mounted && _isRecording) {
          _stopRecording();
        }
      },
    );
    if (mounted) setState(() {});
  }

  // ── بدء التسجيل ──────────────────────────────────────
  Future<void> _startRecording() async {
    if (!_speechEnabled) {
      _err('التعرف على الصوت غير متاح في هذا الجهاز');
      return;
    }
    final preText = _notesCtrl.text.trim(); // captured locally — لا نحتاج state
    setState(() {
      _isRecording    = true;
      _recordingStart = DateTime.now();
    });
    _waveController.repeat();

    await _speech.listen(
      onResult: (r) {
        if (!mounted) return;
        final recognized = r.recognizedWords;
        if (recognized.isEmpty) return; // لا تكتب إذا لم يُتعرَّف على شيء
        _notesCtrl.text = preText.isEmpty
            ? recognized
            : '$preText $recognized';
        _notesCtrl.selection = TextSelection.fromPosition(
          TextPosition(offset: _notesCtrl.text.length));
      },
      localeId:       'ar-SA',
      listenFor:      const Duration(minutes: 3),
      pauseFor:       const Duration(seconds: 8),
      partialResults: true,
    );
    // listen() يرجع فوراً — الإيقاف عبر زر الإيقاف أو onStatus/onError
  }

  // ── إيقاف التسجيل ────────────────────────────────────
  Future<void> _stopRecording() async {
    if (_speech.isListening) await _speech.stop();
    _waveController.stop();
    _waveController.reset();
    if (mounted) {
      setState(() {
        _isRecording    = false;
        _recordingStart = null;
      });
    }
  }

  // ── مساعدات ──────────────────────────────────────────
  Future<void> _loadAssigned() async {
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

    if (!mounted) return;
    setState(() {
      _assignedBranches = branches;
      if (branches.length == 1 && _branch == null) {
        _branch = branches.first;
        _city   = _findCity(branches.first);
      }
    });
  }

  String? _findCity(String branch) {
    for (final entry in kBranches.entries) {
      if (entry.value.contains(branch)) return entry.key;
    }
    return null;
  }

  List<String> get _allowedCities {
    if (_assignedBranches.isEmpty) return kBranches.keys.toList();
    return kBranches.keys.where((city) =>
      (kBranches[city] ?? []).any((b) => _assignedBranches.contains(b))
    ).toList();
  }

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
    if (_isRecording) await _stopRecording();
    if (_city == null)   { _err('اختر المحافظة'); return; }
    if (_branch == null) { _err('اختر الفرع');    return; }
    if (_type == null)   { _err('اختر النوع');    return; }
    final notes = _notesCtrl.text.trim();
    if (notes.isEmpty)   { _err('أدخل التفاصيل'); return; }

    setState(() { _submitting = true; });

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
        // إعادة تعيين الفرع والمحافظة إذا كان الموظف له فرع واحد محدد
        if (_assignedBranches.length == 1) {
          _branch = _assignedBranches.first;
          _city   = _findCity(_assignedBranches.first);
        } else {
          _city = null; _branch = null;
        }
        _type = null; _photo = null;
      });
      _notesCtrl.clear();
      _showSuccessDialog();
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

  Future<void> _showSuccessDialog() async {
    if (!mounted) return;
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 8),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 76, height: 76,
                decoration: BoxDecoration(
                  color: const Color(0xFF2E7D32).withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_outline,
                    color: Color(0xFF66BB6A), size: 50),
              ),
              const SizedBox(height: 18),
              const Text('تم الإرسال بنجاح',
                  style: TextStyle(color: Colors.white,
                      fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              const Text(
                'تم إرسال المنتسية للنظام بنجاح\nوستصل للكول سنتر قيد الاستلام',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white54, fontSize: 13, height: 1.7),
              ),
            ],
          ),
          actionsAlignment: MainAxisAlignment.center,
          actions: [
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E7D32),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('حسناً',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
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
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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

  // ── واجهة الموجات الإنلاين (واتساب) ─────────────────
  Widget _buildRecordingBar() {
    return AnimatedBuilder(
      animation: _waveController,
      builder: (context, _) {
        // نحسب الوقت من وقت البدء — لا حاجة لـ Timer أو setState
        final elapsed = _recordingStart != null
            ? DateTime.now().difference(_recordingStart!).inSeconds
            : 0;
        final mins    = elapsed ~/ 60;
        final secs    = elapsed % 60;
        final timeStr =
            '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';

        return Container(
          margin: const EdgeInsets.only(top: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: const Color(0xFF0D1F0F),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFF2E7D32).withOpacity(0.5),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF1B5E20).withOpacity(0.25),
                blurRadius: 14,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Row(
            children: [
              // ── زر الإيقاف (يمين) ─────────────────────
              GestureDetector(
                onTap: _stopRecording,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFE53935),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFE53935).withOpacity(0.45),
                        blurRadius: 12,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: const Icon(Icons.stop_rounded,
                      color: Colors.white, size: 24),
                ),
              ),
              const SizedBox(width: 12),

              // ── الأمواج الصوتية ───────────────────────
              Expanded(
                child: SizedBox(
                  height: 40,
                  child: CustomPaint(
                    painter: _WaveformPainter(
                      progress: _waveController.value,
                      color: const Color(0xFF4CAF50),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),

              // ── أيقونة الميكروفون + الوقت (يسار) ──────
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _BlinkDot(controller: _waveController),
                  const SizedBox(height: 3),
                  Text(
                    timeStr,
                    style: const TextStyle(
                      color: Color(0xFF81C784),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [

          _dropdown(
            label: 'المحافظة', value: _city,
            items: _allowedCities,
            onChanged: _assignedBranches.length == 1
                ? null
                : (v) => setState(() { _city = v; _branch = null; }),
          ),

          _dropdown(
            label: 'الفرع', value: _branch, items: _branches,
            onChanged: (_city == null || _assignedBranches.length == 1)
                ? null
                : (v) => setState(() => _branch = v),
          ),

          _dropdown(
            label: 'النوع', value: _type, items: kTypes,
            onChanged: (v) => setState(() => _type = v),
          ),

          // ── حقل التفاصيل ───────────────────────────────
          const Align(
            alignment: Alignment.centerRight,
            child: Text('التفاصيل',
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
              filled: true,
              fillColor: const Color(0xFF252525),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: Color(0xFFE53935), width: 1.5)),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 10),

          // ── زر التسجيل الصوتي (أخضر ← عرض كامل) ────────
          GestureDetector(
            onTap: _isRecording ? null : _startRecording,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: double.infinity,
              height: 50,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: _isRecording
                      ? [const Color(0xFF1B5E20), const Color(0xFF256427)]
                      : [const Color(0xFF2E7D32), const Color(0xFF43A047)],
                  begin: Alignment.centerRight,
                  end: Alignment.centerLeft,
                ),
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1B5E20).withOpacity(0.45),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _isRecording
                        ? Icons.mic_rounded
                        : Icons.mic_none_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    _isRecording ? 'جاري التسجيل...' : 'التسجيل الصوتي',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── شريط الأمواج الإنلاين (يظهر عند التسجيل) ───
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            transitionBuilder: (child, anim) => SizeTransition(
              sizeFactor: CurvedAnimation(parent: anim, curve: Curves.easeOut),
              child: FadeTransition(opacity: anim, child: child),
            ),
            child: _isRecording
                ? _buildRecordingBar()
                : const SizedBox.shrink(),
          ),

          const SizedBox(height: 20),

          // ── صورة المنتسية ─────────────────────────────
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
                          width: double.infinity,
                          height: 200,
                          fit: BoxFit.cover),
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
                          child: const Icon(Icons.close,
                              color: Colors.white, size: 18),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 8, right: 8,
                      child: GestureDetector(
                        onTap: _pickPhoto,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                              color: const Color(0xFFE53935),
                              borderRadius: BorderRadius.circular(10)),
                          child: const Text('إعادة التصوير',
                              style: TextStyle(
                                  color: Colors.white, fontSize: 12)),
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
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2.5)),
                        SizedBox(width: 12),
                        Text('جاري الإرسال...',
                            style: TextStyle(fontSize: 16)),
                      ],
                    )
                  : const Text('إرسال المنتسية',
                      style: TextStyle(
                          fontSize: 17, fontWeight: FontWeight.bold)),
            ),
          ),

          const SizedBox(height: 30),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  رسم الأمواج الصوتية
// ══════════════════════════════════════════════════════
class _WaveformPainter extends CustomPainter {
  final double progress;
  final Color  color;

  // Paint مُخصَّص مرة واحدة — يُعاد استخدامه في كل frame
  final Paint _bar = Paint()
    ..strokeCap = StrokeCap.round
    ..strokeWidth = 3.2;

  _WaveformPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    const barCount = 28;
    final spacing  = size.width / (barCount * 2 - 1);
    final maxH     = size.height;

    for (int i = 0; i < barCount; i++) {
      final x     = i * spacing * 2;
      final phase = (i / barCount) * 2 * pi;

      final wave1      = sin(progress * 2 * pi + phase);
      final wave2      = sin(progress * 2 * pi * 0.7 + phase * 1.3);
      final normalized = ((wave1 + wave2) / 2 + 1) / 2;
      final barH       = maxH * (0.12 + normalized * 0.78);
      final top        = (maxH - barH) / 2;

      _bar.color = color.withOpacity(0.55 + normalized * 0.45);
      canvas.drawLine(Offset(x, top), Offset(x, top + barH), _bar);
    }
  }

  @override
  bool shouldRepaint(_WaveformPainter old) => old.progress != progress;
}

// ══════════════════════════════════════════════════════
//  نقطة وميض حمراء (مؤشر تسجيل)
// ══════════════════════════════════════════════════════
class _BlinkDot extends StatelessWidget {
  final AnimationController controller;
  const _BlinkDot({required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (_, __) {
        final opacity = (sin(controller.value * 2 * pi) + 1) / 2;
        return Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFFE53935).withOpacity(0.4 + opacity * 0.6),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFE53935).withOpacity(opacity * 0.6),
                blurRadius: 6,
                spreadRadius: 1,
              ),
            ],
          ),
        );
      },
    );
  }
}
