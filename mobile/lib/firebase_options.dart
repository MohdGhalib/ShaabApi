import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      default:
        throw UnsupportedError(
            'DefaultFirebaseOptions are not supported for this platform.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey:            'AIzaSyCjTygkX4HKEcBZxqCtF2L2WOXjXsSQ4oE',
    appId:             '1:610352757409:android:7941589209caaf6eb1cee0',
    messagingSenderId: '610352757409',
    projectId:         'alshaeb-f3f69',
    storageBucket:     'alshaeb-f3f69.firebasestorage.app',
  );
}
