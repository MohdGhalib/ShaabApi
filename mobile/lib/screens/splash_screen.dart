import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';
import 'home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _pulseCtrl;
  late Animation<double>   _pulseAnim;
  late AnimationController _textCtrl;
  late Animation<double>   _textAnim;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(
      vsync:    this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _pulseAnim = Tween<double>(begin: 1.0, end: 1.18).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _textCtrl = AnimationController(
      vsync:    this,
      duration: const Duration(milliseconds: 600),
    );
    _textAnim = CurvedAnimation(parent: _textCtrl, curve: Curves.easeOut);

    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) _textCtrl.forward();
    });

    Future.delayed(const Duration(milliseconds: 3000), () {
      if (!mounted) return;
      _navigate();
    });
  }

  Future<void> _navigate() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('_shaab_token');
    final name  = prefs.getString('_shaab_name');
    final title = prefs.getString('_shaab_title') ?? '';
    final role  = prefs.getString('_shaab_role')  ?? 'cc_employee';

    if (!mounted) return;
    if (token != null && name != null) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => HomeScreen(
            token: token, name: name, title: title, role: role,
          ),
        ),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _textCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScaleTransition(
              scale: _pulseAnim,
              child: Image.asset('assets/logo.png', width: 130, height: 130),
            ),
            const SizedBox(height: 32),
            FadeTransition(
              opacity: _textAnim,
              child: const Text(
                'من الشعب للشعب',
                textDirection: TextDirection.rtl,
                style: TextStyle(
                  color:         Colors.white,
                  fontSize:      22,
                  fontWeight:    FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
