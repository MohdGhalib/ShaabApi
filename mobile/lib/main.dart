import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:workmanager/workmanager.dart';
import 'firebase_options.dart';
import 'screens/splash_screen.dart';
import 'services/navigation_service.dart';
import 'services/notification_service.dart';
import 'services/status_checker.dart';

/// معالج رسائل FCM في الخلفية — يجب أن يكون top-level
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await NotificationService.init();
  final title = message.notification?.title ?? message.data['title'] ?? 'إشعار جديد';
  final body  = message.notification?.body  ?? message.data['body']  ?? '';
  if (body.isNotEmpty) {
    await NotificationService.show(message.hashCode, title, body);
  }
}

/// مهام WorkManager في الخلفية
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

  // تهيئة Firebase
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // معالج رسائل الخلفية
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:           Colors.transparent,
    statusBarIconBrightness:  Brightness.light,
    systemNavigationBarColor: Color(0xFF121212),
  ));

  // تهيئة الإشعارات المحلية
  await NotificationService.init();
  await NotificationService.requestPermission();

  // WorkManager للفحص الدوري
  await Workmanager().initialize(callbackDispatcher, isInDebugMode: false);
  await Workmanager().registerPeriodicTask(
    'shaab_status_check',
    'checkMontasiatStatus',
    frequency:          const Duration(minutes: 15),
    constraints:        Constraints(networkType: NetworkType.connected),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
  );

  // ── معالج رسائل FCM عند فتح التطبيق (المقدمة) ──────────────────────────
  // يُسجَّل هنا مرة واحدة في الـ main isolate بدون أي شرط _initialized
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    final title      = message.notification?.title ?? message.data['title'] ?? 'إشعار';
    final body       = message.notification?.body  ?? message.data['body']  ?? '';
    final montasiaId = message.data['montasiaId']?.toString();
    if (body.isNotEmpty) {
      NotificationService.show(message.hashCode, title, body, payload: montasiaId);
      NotificationService.showInAppBanner(title, body, montasiaId: montasiaId);
    }
  });

  // معالج النقر على إشعار FCM والتطبيق في الخلفية
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    if (message.data.isNotEmpty) {
      NavigationService.handleData(message.data);
    }
  });

  // معالج النقر على إشعار FCM والتطبيق مغلق تماماً
  final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
  if (initialMessage != null && initialMessage.data.isNotEmpty) {
    NavigationService.handleData(initialMessage.data);
  }

  runApp(const ShaabApp());
}

class ShaabApp extends StatelessWidget {
  const ShaabApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title:                'الشعب',
      navigatorKey:         NavigationService.navigatorKey,
      scaffoldMessengerKey: NavigationService.messengerKey,
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
