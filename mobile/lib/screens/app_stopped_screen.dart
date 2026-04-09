import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'splash_screen.dart';

class AppStoppedScreen extends StatefulWidget {
  final String  token;
  final String  reason;
  final String? stopUntil;

  const AppStoppedScreen({
    super.key,
    required this.token,
    required this.reason,
    this.stopUntil,
  });

  @override
  State<AppStoppedScreen> createState() => _AppStoppedScreenState();
}

class _AppStoppedScreenState extends State<AppStoppedScreen> {
  late String  _reason;
  late String? _stopUntil;
  Timer?       _timer;

  @override
  void initState() {
    super.initState();
    _reason    = widget.reason;
    _stopUntil = widget.stopUntil;
    // فحص دوري كل 30 ثانية
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _check());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _check() async {
    final ctrl = await ApiService.fetchAppControl(widget.token);
    if (!mounted) return;

    if (ctrl == null) return; // فشل الاتصال — انتظر الدورة التالية

    final stopped   = ctrl['stopped'] as bool? ?? false;
    final stopUntil = ctrl['stopUntil'] as String?;

    // تحقق إذا انتهى وقت الإيقاف
    bool expired = false;
    if (stopUntil != null) {
      final until = DateTime.tryParse(stopUntil);
      if (until != null && DateTime.now().isAfter(until)) expired = true;
    }

    if (!stopped || expired) {
      // التطبيق عاد للعمل → انتقل للـ Splash
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const SplashScreen()),
          (route) => false,
        );
      }
    } else {
      // تحديث البيانات إذا تغيرت
      setState(() {
        _reason    = ctrl['reason']    as String? ?? _reason;
        _stopUntil = ctrl['stopUntil'] as String? ?? _stopUntil;
      });
    }
  }

  String? _formatStopUntil() {
    if (_stopUntil == null) return null;
    try {
      final d = DateTime.parse(_stopUntil!).toLocal();
      final h = d.hour.toString().padLeft(2, '0');
      final m = d.minute.toString().padLeft(2, '0');
      final dy = d.day.toString().padLeft(2, '0');
      final mo = d.month.toString().padLeft(2, '0');
      return '$h:$m — $dy/$mo/${d.year}';
    } catch (_) { return null; }
  }

  @override
  Widget build(BuildContext context) {
    final stopUntilStr = _formatStopUntil();

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset('assets/logo.png', width: 72, height: 72),
                const SizedBox(height: 32),

                // أيقونة التحذير
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: const Color(0xFFB71C1C).withOpacity(0.12),
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: const Color(0xFFE53935).withOpacity(0.35), width: 2),
                  ),
                  child: const Icon(Icons.block_rounded,
                      color: Color(0xFFE53935), size: 52),
                ),
                const SizedBox(height: 24),

                // العنوان
                const Text(
                  'التطبيق متوقف مؤقتاً',
                  textDirection: TextDirection.rtl,
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),

                // السبب
                if (_reason.isNotEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E1E),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF2A2A2A)),
                    ),
                    child: Column(
                      children: [
                        const Text('السبب',
                            style: TextStyle(color: Colors.white38, fontSize: 12)),
                        const SizedBox(height: 8),
                        Text(
                          _reason,
                          textAlign: TextAlign.center,
                          textDirection: TextDirection.rtl,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 15, height: 1.6),
                        ),
                      ],
                    ),
                  ),

                // وقت الاستئناف
                if (stopUntilStr != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A2A1A),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: const Color(0xFF4CAF50).withOpacity(0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.access_time,
                            color: Color(0xFF81C784), size: 16),
                        const SizedBox(width: 8),
                        Text('يُستأنف في: $stopUntilStr',
                            textDirection: TextDirection.rtl,
                            style: const TextStyle(
                                color: Color(0xFF81C784), fontSize: 13)),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 20),
                const Text(
                  'يُرجى الانتظار حتى يُستأنف التطبيق',
                  textDirection: TextDirection.rtl,
                  style: TextStyle(color: Colors.white38, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
