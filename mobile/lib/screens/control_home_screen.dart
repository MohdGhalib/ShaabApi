import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/status_checker.dart';
import 'login_screen.dart';
import 'control_montasiat_screen.dart';
import 'control_complaints_screen.dart';

class ControlHomeScreen extends StatefulWidget {
  final String token;
  final String name;
  final String title;
  final String role;

  const ControlHomeScreen({
    super.key,
    required this.token,
    required this.name,
    required this.title,
    required this.role,
  });

  @override
  State<ControlHomeScreen> createState() => _ControlHomeScreenState();
}

class _ControlHomeScreenState extends State<ControlHomeScreen>
    with WidgetsBindingObserver {
  int _tab = 0;
  final ValueNotifier<int> _refreshTrigger = ValueNotifier(0);

  // مدير السيطرة: تبويبان | موظف السيطرة: شكاوى فقط
  bool get _isManager => widget.role == 'control_employee';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refreshTrigger.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      StatusChecker.check();
      _refreshTrigger.value++;
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('تسجيل الخروج',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          content: const Text('هل تريد تسجيل الخروج من التطبيق؟',
              style: TextStyle(color: Colors.white70, fontSize: 14)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE53935),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('خروج',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    await ApiService.unregisterFcmToken(widget.token);
    await ApiService.clearToken();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('_shaab_name');
    await prefs.remove('_shaab_title');
    await prefs.remove('_shaab_role');
    await prefs.remove('_shaab_empId');
    await prefs.setBool('_shaab_biometric_enabled', false);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  String get _tabTitle {
    if (!_isManager) return 'الشكاوى';
    return _tab == 0 ? 'اطلاع المنتسيات' : 'الشكاوى';
  }

  @override
  Widget build(BuildContext context) {
    final complaintsScreen = ControlComplaintsScreen(
      token:          widget.token,
      name:           widget.name,
      role:           widget.role,
      refreshTrigger: _refreshTrigger,
    );

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        elevation: 0,
        centerTitle: true,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/logo.png', width: 28, height: 28),
            const SizedBox(width: 8),
            Text(
              _tabTitle,
              style: const TextStyle(
                  color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Color(0xFFE53935)),
            tooltip: 'تسجيل الخروج',
            onPressed: _logout,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(34),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
            color: const Color(0xFF151515),
            child: Text(
              '${widget.name} · ${widget.title}',
              textAlign: TextAlign.right,
              textDirection: TextDirection.rtl,
              style: const TextStyle(color: Colors.white54, fontSize: 12),
            ),
          ),
        ),
      ),

      // مدير السيطرة: IndexedStack بتبويبين | موظف: شاشة واحدة
      body: _isManager
          ? IndexedStack(
              index: _tab,
              children: [
                ControlMontasiatScreen(
                  token:          widget.token,
                  refreshTrigger: _refreshTrigger,
                ),
                complaintsScreen,
              ],
            )
          : complaintsScreen,

      bottomNavigationBar: _isManager
          ? BottomNavigationBar(
              currentIndex: _tab,
              onTap: (i) {
                setState(() => _tab = i);
                _refreshTrigger.value++;
              },
              backgroundColor:      const Color(0xFF1A1A1A),
              selectedItemColor:    const Color(0xFFE53935),
              unselectedItemColor:  Colors.white38,
              selectedLabelStyle:   const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              unselectedLabelStyle: const TextStyle(fontSize: 12),
              items: const [
                BottomNavigationBarItem(
                  icon:       Icon(Icons.assignment_outlined),
                  activeIcon: Icon(Icons.assignment),
                  label:      'المنتسيات',
                ),
                BottomNavigationBarItem(
                  icon:       Icon(Icons.security_outlined),
                  activeIcon: Icon(Icons.security),
                  label:      'الشكاوى',
                ),
              ],
            )
          : null,
    );
  }
}
