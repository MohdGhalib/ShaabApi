import 'package:flutter/material.dart';

class NavigationService {
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  /// ID المنتسية المعلّق للانتقال إليها عند فتح الإشعار
  static final ValueNotifier<int?> pendingMontasiaId =
      ValueNotifier<int?>(null);

  /// استخراج montasiaId من بيانات الإشعار وتخزينه
  static void handleData(Map<String, dynamic> data) {
    final idStr = data['montasiaId']?.toString();
    if (idStr != null && idStr.isNotEmpty) {
      final id = int.tryParse(idStr);
      if (id != null) pendingMontasiaId.value = id;
    }
  }
}
