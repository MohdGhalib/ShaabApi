import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:workmanager/workmanager.dart';
import 'screens/splash_screen.dart';
import 'services/notification_service.dart';
import 'services/status_checker.dart';

/// نقطة الدخول لمهام الخلفية — يجب أن تكون دالة مستقلة (top-level)
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    await NotificationService.init();
    await StatusChecker.check();
    return true;
  });
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:           Colors.transparent,
    statusBarIconBrightness:  Brightness.light,
    systemNavigationBarColor: Color(0xFF121212),
  ));

  // تهيئة الإشعارات
  await NotificationService.init();
  await NotificationService.requestPermission();

  // تهيئة WorkManager للفحص في الخلفية
  await Workmanager().initialize(callbackDispatcher, isInDebugMode: false);
  await Workmanager().registerPeriodicTask(
    'shaab_status_check',
    'checkMontasiatStatus',
    frequency:          const Duration(minutes: 15),
    constraints:        Constraints(networkType: NetworkType.connected),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
  );

  runApp(const ShaabApp());
}

class ShaabApp extends StatelessWidget {
  const ShaabApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title:        'الشعب',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme:  ColorScheme.fromSeed(
          seedColor:  const Color(0xFFE53935),
          brightness: Brightness.dark,
        ),
        textTheme:    GoogleFonts.cairoTextTheme(
          ThemeData.dark().textTheme,
        ),
        scaffoldBackgroundColor: const Color(0xFF121212),
        useMaterial3: true,
      ),
      home: const SplashScreen(),
    );
  }
}
