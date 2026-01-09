package com.xgimm.www

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class KeepAliveService : Service() {
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "keep_alive_channel"
        private const val CHANNEL_NAME = "XG-IM 保活服务"
        
        fun startService(context: Context) {
            val intent = Intent(context, KeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
        
        fun stopService(context: Context) {
            val intent = Intent(context, KeepAliveService::class.java)
            context.stopService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // 返回 START_STICKY 确保服务被系统杀死后自动重启
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH  // 高优先级：默认开启，有声音和横幅通知
            ).apply {
                description = "XG-IM 应用保活服务"
                setShowBadge(false)
                // 虽然是高优先级，但禁用声音和震动，避免持续打扰用户
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 尝试使用应用图标，如果不存在则使用系统默认图标
        val iconResId = resources.getIdentifier("ic_launcher", "mipmap", packageName)
        val smallIcon = if (iconResId != 0) iconResId else android.R.drawable.ic_menu_info_details

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("XG-IM")
            .setContentText("应用正在后台运行")
            .setSmallIcon(smallIcon)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)  // 与 channel 保持一致，兼容 Android O 以下
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        // 服务被销毁时尝试重启
        val intent = Intent(this, KeepAliveService::class.java)
        startService(intent)
    }
}

