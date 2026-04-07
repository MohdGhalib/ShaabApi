import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:           Colors.transparent,
    statusBarIconBrightness:  Brightness.light,
    systemNavigationBarColor: Color(0xFF121212),
  ));
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
          seedColor:   const Color(0xFFE53935),
          brightness:  Brightness.dark,
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
