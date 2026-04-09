import 'package:flutter/material.dart';

class NavigationService {
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static final GlobalKey<ScaffoldMessengerState> messengerKey =
      GlobalKey<ScaffoldMessengerState>();

  /// ID المنتسية المعلّق للانتقال إليها عند فتح الإشعار
  static final ValueNotifier<int?> pendingMontasiaId =
      ValueNotifier<int?>(null);

  /// ID الشكوى المعلّق للانتقال إليها عند فتح الإشعار
  static final ValueNotifier<int?> pendingComplaintId =
      ValueNotifier<int?>(null);

  /// استخراج montasiaId أو complaintId من بيانات الإشعار وتخزينه
  static void handleData(Map<String, dynamic> data) {
    final idStr = data['montasiaId']?.toString();
    if (idStr != null && idStr.isNotEmpty) {
      final id = int.tryParse(idStr);
      if (id != null) pendingMontasiaId.value = id;
    }
    final cIdStr = data['complaintId']?.toString();
    if (cIdStr != null && cIdStr.isNotEmpty) {
      final id = int.tryParse(cIdStr);
      if (id != null) pendingComplaintId.value = id;
    }
  }
}
