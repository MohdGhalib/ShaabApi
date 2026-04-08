import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/status_checker.dart';
import 'login_screen.dart';
import 'add_montasia_screen.dart';
import 'my_montasiat_screen.dart';
import 'branch_complaints_screen.dart';

class BranchManagerHomeScreen extends StatefulWidget {
  final String token;
  final String name;
  final String title;
  final String role;
  final String empId;

  const BranchManagerHomeScreen({
    super.key,
    required this.token,
    required this.name,
    required this.title,
    required this.role,
    this.empId = '',
  });

  @override
  State<BranchManagerHomeScreen> createState() => _BranchManagerHomeScreenState();
}

class _BranchManagerHomeScreenState extends State<BranchManagerHomeScreen>
    with WidgetsBindingObserver {
  int _tab = 0;
  final ValueNotifier<int> _refreshTrigger = ValueNotifier(0);

  static const _titles = ['إضافة منتسية', 'منتسياتي', 'الشكاوى'];

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
              _titles[_tab],
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
            refreshTrigger: _refreshTrigger,
          ),
          BranchComplaintsScreen(
            token:          widget.token,
            name:           widget.name,
            role:           widget.role,
            empId:          widget.empId,
            refreshTrigger: _refreshTrigger,
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
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
            icon:       Icon(Icons.add_circle_outline),
            activeIcon: Icon(Icons.add_circle),
            label:      'إضافة منتسية',
          ),
          BottomNavigationBarItem(
            icon:       Icon(Icons.list_alt_outlined),
            activeIcon: Icon(Icons.list_alt),
            label:      'منتسياتي',
          ),
          BottomNavigationBarItem(
            icon:       Icon(Icons.security_outlined),
            activeIcon: Icon(Icons.security),
            label:      'الشكاوى',
          ),
        ],
      ),
    );
  }
}
