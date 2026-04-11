import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'navigation_service.dart';

class NotificationService {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static const _channelId   = 'shaab_v5';
  static const _channelName = 'إشعارات الشعب';
  static const _channelDesc = 'إشعارات المنتسيات والشكاوي والاستفسارات';

  static Future<void> init() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: androidSettings);

    // معالج النقر على الإشعار المحلي (التطبيق في المقدمة)
    await _plugin.initialize(
      settings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final payload = response.payload;
        if (payload != null && payload.isNotEmpty) {
          if (payload.startsWith('complaintId:')) {
            final id = int.tryParse(payload.substring('complaintId:'.length));
            if (id != null) NavigationService.pendingComplaintId.value = id;
          } else {
            NavigationService.handleData({'montasiaId': payload});
          }
        }
      },
    );

    const channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: _channelDesc,
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
      sound: RawResourceAndroidNotificationSound('consideration'),
    );
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    _initialized = true;
    // onMessage.listen مسجَّل في main.dart لضمان تشغيله في الـ main isolate دائماً
  }

  static Future<void> requestPermission() async {
    // طلب إذن إشعارات FCM
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    // طلب إذن إشعارات محلية (Android 13+)
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  /// الحصول على FCM Token الجهاز
  static Future<String?> getFcmToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }

  static Future<void> show(int id, String title, String body,
      {String? payload}) async {
    await _plugin.show(
      id,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDesc,
          importance: Importance.max,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          sound: const RawResourceAndroidNotificationSound('consideration'),
          styleInformation: BigTextStyleInformation(body),
        ),
      ),
      payload: payload,
    );
  }

  /// بانر إشعار داخلي يظهر فوق الشاشة عند استقبال إشعار والتطبيق مفتوح
  static void showInAppBanner(String title, String body,
      {String? montasiaId, String? complaintId}) {
    void handleTap() {
      if (montasiaId != null) {
        NavigationService.handleData({'montasiaId': montasiaId});
      } else if (complaintId != null) {
        final id = int.tryParse(complaintId);
        if (id != null) NavigationService.pendingComplaintId.value = id;
      }
    }

    // الطريقة الأساسية: OverlayEntry عبر NavigatorState مباشرة
    final overlay = NavigationService.navigatorKey.currentState?.overlay;
    if (overlay != null) {
      late OverlayEntry entry;
      entry = OverlayEntry(
        builder: (_) => _NotificationBanner(
          title: title,
          body: body,
          onTap: () {
            try { entry.remove(); } catch (_) {}
            handleTap();
          },
          onDismiss: () {
            try { entry.remove(); } catch (_) {}
          },
        ),
      );
      overlay.insert(entry);
      Future.delayed(const Duration(seconds: 5), () {
        try { entry.remove(); } catch (_) {}
      });
      return;
    }

    // الطريقة الاحتياطية: SnackBar عبر ScaffoldMessengerKey
    final messenger = NavigationService.messengerKey.currentState;
    if (messenger == null) return;
    messenger.showSnackBar(SnackBar(
      content: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(children: [
          const Icon(Icons.notifications_active, color: Color(0xFF81C784), size: 20),
          const SizedBox(width: 10),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              if (body.isNotEmpty)
                Text(body, style: const TextStyle(fontSize: 12, color: Colors.white70)),
            ],
          )),
        ]),
      ),
      backgroundColor: const Color(0xFF1E2A1E),
      duration: const Duration(seconds: 5),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      action: (montasiaId != null || complaintId != null)
          ? SnackBarAction(
              label: 'عرض',
              textColor: const Color(0xFF81C784),
              onPressed: handleTap,
            )
          : null,
    ));
  }
}

// ── بانر الإشعار الداخلي ─────────────────────────────────────────────────────
class _NotificationBanner extends StatefulWidget {
  final String title;
  final String body;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  const _NotificationBanner({
    required this.title,
    required this.body,
    required this.onTap,
    required this.onDismiss,
  });

  @override
  State<_NotificationBanner> createState() => _NotificationBannerState();
}

class _NotificationBannerState extends State<_NotificationBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<Offset>   _slide;

  @override
  void initState() {
    super.initState();
    _ctrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 350));
    _slide = Tween<Offset>(begin: const Offset(0, -1.5), end: Offset.zero)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.of(context).padding.top + 10,
      left: 14,
      right: 14,
      child: Material(
        color: Colors.transparent,
        child: SlideTransition(
          position: _slide,
          child: GestureDetector(
            onTap: widget.onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E2A1E),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: const Color(0xFF4CAF50).withOpacity(0.5), width: 1.2),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 4)),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4CAF50).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.notifications_active,
                        color: Color(0xFF81C784), size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.title,
                          textDirection: TextDirection.rtl,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 13),
                        ),
                        if (widget.body.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            widget.body,
                            textDirection: TextDirection.rtl,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white60, fontSize: 12),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: widget.onDismiss,
                    child: const Icon(Icons.close,
                        color: Colors.white30, size: 18),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
