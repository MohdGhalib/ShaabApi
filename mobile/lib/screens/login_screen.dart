import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import 'home_screen.dart';
import 'manager_home_screen.dart';
import 'control_home_screen.dart';
import 'branch_manager_home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _empIdCtrl = TextEditingController();
  bool    _loading            = false;
  String? _errorMsg;
  bool    _biometricAvailable = false;
  bool    _hasSavedEmpId      = false;
  bool    _enableBiometric    = false; // حالة مربع الاختيار

  late AnimationController _shakeCtrl;
  late Animation<double>   _shakeAnim;
  final _auth = LocalAuthentication();

  @override
  void initState() {
    super.initState();
    _shakeCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _shakeAnim = Tween<double>(begin: 0, end: 12).animate(
        CurvedAnimation(parent: _shakeCtrl, curve: Curves.elasticIn));
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    try {
      final canCheck    = await _auth.canCheckBiometrics;
      final isSupported = await _auth.isDeviceSupported();
      final prefs       = await SharedPreferences.getInstance();
      final savedId     = prefs.getString('_shaab_empId');
      final bioEnabled  = prefs.getBool('_shaab_biometric_enabled') ?? false;
      if (mounted) {
        setState(() {
          _biometricAvailable = canCheck && isSupported;
          _hasSavedEmpId      = savedId != null && savedId.isNotEmpty;
          _enableBiometric    = bioEnabled;
        });
      }
    } catch (_) {}
  }

  Future<void> _biometricLogin() async {
    try {
      final didAuth = await _auth.authenticate(
        localizedReason: 'استخدم بصمتك للدخول',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth:    true,
        ),
      );
      if (!didAuth || !mounted) return;

      final prefs   = await SharedPreferences.getInstance();
      final savedId = prefs.getString('_shaab_empId') ?? '';
      if (savedId.isEmpty) {
        _shake('فعّل البصمة أولاً من خيار "تفعيل الدخول بالبصمة"');
        return;
      }
      _empIdCtrl.text = savedId;
      await _login(fromBiometric: true);
    } catch (_) {
      if (mounted) _shake('البصمة غير متاحة');
    }
  }

  Future<void> _login({bool fromBiometric = false}) async {
    if (_loading) return;
    final empId = _empIdCtrl.text.trim();
    if (empId.isEmpty) { _shake('أدخل الرقم الوظيفي'); return; }

    setState(() { _loading = true; _errorMsg = null; });
    final result = await ApiService.login(empId);
    if (!mounted) return;
    setState(() => _loading = false);

    if (result.ok) {
      // موظف الكول سنتر لا يمكنه الدخول من التطبيق
      if (result.role == 'cc_employee') {
        _shake('غير مسموح لهذه الصلاحية بالدخول من التطبيق');
        return;
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('_shaab_name',  result.name);
      await prefs.setString('_shaab_title', result.title);
      await prefs.setString('_shaab_role',  result.role);

      // حفظ أو حذف البصمة بحسب الاختيار
      if (fromBiometric) {
        // دخول عبر البصمة → ابقِ الإعدادات كما هي
        await prefs.setString('_shaab_empId', empId);
        await prefs.setBool('_shaab_biometric_enabled', true);
      } else if (_enableBiometric) {
        // المستخدم فعّل المربع → اطلب البصمة الآن للتحقق
        bool bioConfirmed = false;
        try {
          bioConfirmed = await _auth.authenticate(
            localizedReason: 'سجّل بصمتك لتفعيل الدخول السريع',
            options: const AuthenticationOptions(
              biometricOnly: true,
              stickyAuth:    true,
            ),
          );
        } catch (_) {}

        if (bioConfirmed) {
          await prefs.setString('_shaab_empId', empId);
          await prefs.setBool('_shaab_biometric_enabled', true);
        } else {
          // لم تنجح البصمة → لا تفعّل
          await prefs.remove('_shaab_empId');
          await prefs.setBool('_shaab_biometric_enabled', false);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text('لم يتم تفعيل البصمة',
                  textDirection: TextDirection.rtl),
              backgroundColor: Color(0xFFB71C1C),
              behavior: SnackBarBehavior.floating,
            ));
          }
        }
      } else {
        // المربع غير مفعّل → احذف البصمة
        await prefs.remove('_shaab_empId');
        await prefs.setBool('_shaab_biometric_enabled', false);
      }

      if (!mounted) return;
      final role             = result.role;
      final isManager        = role == 'cc_manager' || result.isAdmin;
      final isControl        = role == 'control_employee' || role == 'control_sub' || role == 'media';
      final isBranchManager  = role == 'branch_manager' || role == 'area_manager';

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) {
            if (isManager) {
              return ManagerHomeScreen(
                token: result.token, name: result.name,
                title: result.title, role: role,
              );
            }
            if (isControl) {
              return ControlHomeScreen(
                token: result.token, name: result.name,
                title: result.title, role: role,
              );
            }
            if (isBranchManager) {
              return BranchManagerHomeScreen(
                token: result.token, name: result.name,
                title: result.title, role: role,
                empId: empId,
              );
            }
            return HomeScreen(
              token: result.token, name: result.name,
              title: result.title, role: role,
            );
          },
        ),
      );
    } else {
      _shake(result.errorMsg ?? 'خطأ في تسجيل الدخول');
    }
  }

  void _shake(String msg) {
    setState(() => _errorMsg = msg);
    _shakeCtrl.forward(from: 0);
  }

  @override
  void dispose() {
    _empIdCtrl.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset('assets/logo.png', width: 100, height: 100),
                const SizedBox(height: 16),
                const Text('من الشعب للشعب',
                    textDirection: TextDirection.rtl,
                    style: TextStyle(
                        color: Colors.white70, fontSize: 14, letterSpacing: 1)),
                const SizedBox(height: 40),

                AnimatedBuilder(
                  animation: _shakeAnim,
                  builder: (ctx, child) => Transform.translate(
                    offset: Offset(
                      _shakeCtrl.isAnimating
                          ? (_shakeCtrl.value < 0.5
                              ? _shakeAnim.value
                              : -_shakeAnim.value)
                          : 0,
                      0,
                    ),
                    child: child,
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E1E),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF2A2A2A)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('تسجيل الدخول',
                            textAlign: TextAlign.right,
                            textDirection: TextDirection.rtl,
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold)),
                        const SizedBox(height: 24),

                        // ── حقل الرقم الوظيفي ──────────────────────
                        TextFormField(
                          controller:    _empIdCtrl,
                          keyboardType:  TextInputType.number,
                          textAlign:     TextAlign.right,
                          textDirection: TextDirection.rtl,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 18,
                              fontFamily: 'monospace', letterSpacing: 3),
                          decoration: InputDecoration(
                            labelText:  'الرقم الوظيفي',
                            labelStyle: const TextStyle(color: Colors.white54),
                            prefixIcon: const Icon(Icons.badge_outlined,
                                color: Color(0xFFE53935)),
                            filled:    true,
                            fillColor: const Color(0xFF252525),
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide.none),
                            focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(
                                    color: Color(0xFFE53935), width: 1.5)),
                          ),
                          onFieldSubmitted: (_) => _login(),
                        ),

                        // ── رسالة الخطأ ────────────────────────────
                        if (_errorMsg != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                vertical: 10, horizontal: 14),
                            decoration: BoxDecoration(
                              color:        const Color(0x22E53935),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                  color: const Color(0x55E53935)),
                            ),
                            child: Text(_errorMsg!,
                                textAlign:     TextAlign.right,
                                textDirection: TextDirection.rtl,
                                style: const TextStyle(
                                    color: Color(0xFFEF9A9A), fontSize: 13)),
                          ),
                        ],

                        const SizedBox(height: 20),

                        // ── زر الدخول ──────────────────────────────
                        SizedBox(
                          height: 50,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _login,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE53935),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                            ),
                            child: _loading
                                ? const SizedBox(
                                    width: 22, height: 22,
                                    child: CircularProgressIndicator(
                                        color: Colors.white, strokeWidth: 2.5))
                                : const Text('دخول',
                                    style: TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.bold)),
                          ),
                        ),

                        // ── مربع تفعيل البصمة ──────────────────────
                        if (_biometricAvailable) ...[
                          const SizedBox(height: 16),
                          GestureDetector(
                            onTap: () => setState(
                                () => _enableBiometric = !_enableBiometric),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                const Text('تفعيل الدخول بالبصمة',
                                    textDirection: TextDirection.rtl,
                                    style: TextStyle(
                                        color: Colors.white70, fontSize: 14)),
                                const SizedBox(width: 10),
                                AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  width:  22,
                                  height: 22,
                                  decoration: BoxDecoration(
                                    color: _enableBiometric
                                        ? const Color(0xFFE53935)
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                      color: _enableBiometric
                                          ? const Color(0xFFE53935)
                                          : const Color(0xFF555555),
                                      width: 2,
                                    ),
                                  ),
                                  child: _enableBiometric
                                      ? const Icon(Icons.check,
                                          color: Colors.white, size: 14)
                                      : null,
                                ),
                              ],
                            ),
                          ),
                        ],

                        // ── زر البصمة (يظهر إذا مفعّلة مسبقاً) ────
                        if (_biometricAvailable && _hasSavedEmpId) ...[
                          const SizedBox(height: 16),
                          const Row(children: [
                            Expanded(child: Divider(color: Color(0xFF2A2A2A))),
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: 12),
                              child: Text('أو',
                                  style: TextStyle(
                                      color: Colors.white38, fontSize: 12)),
                            ),
                            Expanded(child: Divider(color: Color(0xFF2A2A2A))),
                          ]),
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 50,
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.fingerprint,
                                  color: Color(0xFFE53935), size: 26),
                              label: const Text('الدخول بالبصمة',
                                  style: TextStyle(
                                      color: Colors.white70, fontSize: 15)),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(
                                    color: Color(0xFF2A2A2A)),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                              onPressed: _biometricLogin,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
