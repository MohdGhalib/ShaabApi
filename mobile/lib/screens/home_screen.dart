import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/navigation_service.dart';
import '../services/status_checker.dart';
import 'login_screen.dart';
import 'add_montasia_screen.dart';
import 'my_montasiat_screen.dart';
import 'app_stopped_screen.dart';

class HomeScreen extends StatefulWidget {
  final String token;
  final String name;
  final String title;
  final String role;
  final String empId;

  const HomeScreen({
    super.key,
    required this.token,
    required this.name,
    required this.title,
    required this.role,
    this.empId = '',
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _tab = 0;
  final ValueNotifier<int> _refreshTrigger = ValueNotifier(0);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // إذا كان هناك إشعار منتسية معلّق → انتقل لتاب منتسياتي
    if (NavigationService.pendingMontasiaId.value != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _switchToMontasiat());
    }
    NavigationService.pendingMontasiaId.addListener(_onPendingMontasia);
  }

  @override
  void dispose() {
    NavigationService.pendingMontasiaId.removeListener(_onPendingMontasia);
    WidgetsBinding.instance.removeObserver(this);
    _refreshTrigger.dispose();
    super.dispose();
  }

  void _onPendingMontasia() {
    if (NavigationService.pendingMontasiaId.value != null) {
      _switchToMontasiat();
    }
  }

  void _switchToMontasiat() {
    setState(() => _tab = 1);
    _refreshTrigger.value++;
  }

  /// يُفحص الحالات عند استئناف التطبيق من الخلفية
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      StatusChecker.check();
      _checkAppControl();
      if (_tab == 1) _refreshTrigger.value++;
    }
  }

  Future<void> _checkAppControl() async {
    final ctrl = await ApiService.fetchAppControl(widget.token);
    if (ctrl == null || !mounted) return;
    final stopped = ctrl['stopped'] as bool? ?? false;
    if (!stopped) return;
    final stoppedAt = ctrl['stoppedAt'] as String?;
    if (stoppedAt != null) {
      final from = DateTime.tryParse(stoppedAt);
      if (from != null && DateTime.now().isBefore(from)) return;
    }
    final stopUntil = ctrl['stopUntil'] as String?;
    if (stopUntil != null) {
      final until = DateTime.tryParse(stopUntil);
      if (until != null && DateTime.now().isAfter(until)) return;
    }
    if (!mounted) return;
    final reason = ctrl['reason'] as String? ?? '';
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => AppStoppedScreen(
          token: widget.token, reason: reason, stopUntil: stopUntil),
      ),
      (route) => false,
    );
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
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
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
              _tab == 0 ? 'إضافة منتسية' : 'منتسياتي',
              style: const TextStyle(
                color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold,
              ),
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
      body: IndexedStack(
        index: _tab,
        children: [
          AddMontasiaTab(
            token: widget.token,
            name:  widget.name,
            title: widget.title,
            role:  widget.role,
            empId: widget.empId,
          ),
          MyMontasiatScreen(
            token:          widget.token,
            name:           widget.name,
            empId:          widget.empId,
            refreshTrigger: _refreshTrigger,
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        onTap: (i) {
          setState(() => _tab = i);
          if (i == 1) _refreshTrigger.value++;
        },
        backgroundColor: const Color(0xFF1A1A1A),
        selectedItemColor: const Color(0xFFE53935),
        unselectedItemColor: Colors.white38,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
        unselectedLabelStyle: const TextStyle(fontSize: 12),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.add_circle_outline),
            activeIcon: Icon(Icons.add_circle),
            label: 'إضافة منتسية',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.list_alt_outlined),
            activeIcon: Icon(Icons.list_alt),
            label: 'منتسياتي',
          ),
        ],
      ),
    );
  }
}
