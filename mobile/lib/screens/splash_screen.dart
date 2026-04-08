import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';
import 'login_screen.dart';
import 'home_screen.dart';
import 'manager_home_screen.dart';
import 'control_home_screen.dart';
import 'branch_manager_home_screen.dart';

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

    Future.delayed(const Duration(milliseconds: 2500), () {
      if (!mounted) return;
      _navigate();
    });
  }

  Future<void> _navigate() async {
    final prefs    = await SharedPreferences.getInstance();
    final token    = prefs.getString('_shaab_token');
    final name     = prefs.getString('_shaab_name');
    final title    = prefs.getString('_shaab_title') ?? '';
    final role     = prefs.getString('_shaab_role')  ?? 'cc_employee';
    final bioOn    = prefs.getBool('_shaab_biometric_enabled') ?? false;
    final savedId  = prefs.getString('_shaab_empId') ?? '';

    if (!mounted) return;

    // لا يوجد جلسة محفوظة → شاشة الدخول
    if (token == null || name == null) {
      _goLogin();
      return;
    }

    // موظف الكول سنتر لا يمكنه الدخول من التطبيق
    if (role == 'cc_employee') {
      _goLogin();
      return;
    }

    // البصمة مفعّلة → يجب التحقق منها قبل الدخول
    if (bioOn && savedId.isNotEmpty) {
      final auth = LocalAuthentication();
      try {
        final ok = await auth.authenticate(
          localizedReason: 'أثبت هويتك للدخول',
          options: const AuthenticationOptions(
            biometricOnly: true,
            stickyAuth:    true,
          ),
        );
        if (!mounted) return;
        if (ok) {
          _goHome(token, name, title, role, empId: savedId);
        } else {
          // فشلت البصمة → شاشة الدخول
          _goLogin();
        }
      } catch (_) {
        if (mounted) _goLogin();
      }
      return;
    }

    // لا بصمة → دخول مباشر
    _goHome(token, name, title, role, empId: savedId);
  }

  void _goHome(String token, String name, String title, String role, {String empId = ''}) {
    // تجديد FCM token عند كل دخول تلقائي
    if (empId.isNotEmpty) {
      NotificationService.getFcmToken().then((fcmToken) {
        if (fcmToken != null) {
          ApiService.registerFcmToken(token, empId, role, fcmToken);
        }
      });
    }
    final isManager       = role == 'cc_manager' || role == 'admin';
    final isControl       = role == 'control_employee' || role == 'control_sub' || role == 'media';
    final isBranchManager = role == 'branch_manager' || role == 'area_manager';
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) {
          if (isManager)       return ManagerHomeScreen(token: token, name: name, title: title, role: role);
          if (isControl)       return ControlHomeScreen(token: token, name: name, title: title, role: role);
          if (isBranchManager) return BranchManagerHomeScreen(token: token, name: name, title: title, role: role, empId: empId);
          return HomeScreen(token: token, name: name, title: title, role: role, empId: empId);
        },
      ),
    );
  }

  void _goLogin() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
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
