package com.shaab.Control

import android.app.Application
import android.app.NotificationManager
import android.os.Build

class ShaabApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return

        // حذف القنوات القديمة فقط — الإنشاء يتولاه flutter_local_notifications
        listOf("shaab_v2","shaab_v3","shaab_v4","shaab_v5","shaab_v6","shaab_v7")
            .forEach { manager.deleteNotificationChannel(it) }
    }
}
