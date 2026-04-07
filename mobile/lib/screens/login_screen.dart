import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _empIdCtrl = TextEditingController();
  bool  _loading   = false;
  String? _errorMsg;
  bool  _biometricAvailable = false;
  bool  _hasSavedEmpId      = false;

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
      if (mounted) {
        setState(() {
          _biometricAvailable = canCheck && isSupported;
          _hasSavedEmpId      = savedId != null && savedId.isNotEmpty;
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
        _shake('لم يتم حفظ الرقم الوظيفي، سجّل دخول بالرقم أولاً');
        return;
      }
      _empIdCtrl.text = savedId;
      await _login();
    } catch (_) {
      if (mounted) _shake('البصمة غير متاحة');
    }
  }

  Future<void> _login() async {
    if (_loading) return;
    final empId = _empIdCtrl.text.trim();
    if (empId.isEmpty) { _shake('أدخل الرقم الوظيفي'); return; }

    setState(() { _loading = true; _errorMsg = null; });
    final result = await ApiService.login(empId);
    if (!mounted) return;
    setState(() => _loading = false);

    if (result.ok) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('_shaab_name',  result.name);
      await prefs.setString('_shaab_title', result.title);
      await prefs.setString('_shaab_role',  result.role);
      await prefs.setString('_shaab_empId', empId);

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => HomeScreen(
            token: result.token,
            name:  result.name,
            title: result.title,
            role:  result.role,
          ),
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
                            filled:     true,
                            fillColor:  const Color(0xFF252525),
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

                        if (_errorMsg != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                vertical: 10, horizontal: 14),
                            decoration: BoxDecoration(
                              color:  const Color(0x22E53935),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0x55E53935)),
                            ),
                            child: Text(_errorMsg!,
                                textAlign:     TextAlign.right,
                                textDirection: TextDirection.rtl,
                                style: const TextStyle(
                                    color: Color(0xFFEF9A9A), fontSize: 13)),
                          ),
                        ],

                        const SizedBox(height: 20),

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

                        // ── زر البصمة ──────────────────────────────
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
