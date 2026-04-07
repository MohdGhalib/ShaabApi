import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import 'login_screen.dart';
import 'add_montasia_screen.dart';
import 'my_montasiat_screen.dart';

class HomeScreen extends StatefulWidget {
  final String token;
  final String name;
  final String title;
  final String role;

  const HomeScreen({
    super.key,
    required this.token,
    required this.name,
    required this.title,
    required this.role,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  final ValueNotifier<int> _refreshTrigger = ValueNotifier(0);

  @override
  void dispose() {
    _refreshTrigger.dispose();
    super.dispose();
  }

  Future<void> _logout() async {
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
          ),
          MyMontasiatScreen(
            token:          widget.token,
            name:           widget.name,
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
