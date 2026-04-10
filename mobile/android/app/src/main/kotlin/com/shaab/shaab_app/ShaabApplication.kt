package com.shaab.shaab_app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

class ShaabApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return

        val soundUri = Uri.parse("android.resource://$packageName/raw/consideration")
        val audioAttr = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build()

        // حذف القنوات القديمة لضمان تطبيق الصوت الصحيح
        manager.deleteNotificationChannel("shaab_v2")
        manager.deleteNotificationChannel("shaab_v3")

        val channel = NotificationChannel(
            "shaab_v4",
            "إشعارات الشعب",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "إشعارات المنتسيات والشكاوي والاستفسارات"
            setSound(soundUri, audioAttr)
            enableVibration(true)
        }

        manager.createNotificationChannel(channel)
    }
}
