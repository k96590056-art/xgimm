package com.xgimm.www

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

object MessageNotificationService {
    private const val CHANNEL_ID = "message_notification_channel"
    private const val CHANNEL_NAME = "XG-IM 消息通知"
    private const val CHANNEL_DESCRIPTION = "接收新消息时显示通知"
    private var notificationId = 2000 // 从 2000 开始，避免与保活服务冲突

    /**
     * 初始化通知渠道
     */
    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
            }
            val notificationManager = context.getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * 显示消息通知
     * @param context 上下文
     * @param senderName 发送者名称
     * @param messageContent 消息内容
     * @param roomId 房间ID（可选，用于点击通知时跳转）
     */
    fun showMessageNotification(
        context: Context,
        senderName: String,
        messageContent: String,
        roomId: String? = null
    ) {
        createNotificationChannel(context)

        // 创建点击通知时打开的 Intent
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        roomId?.let {
            intent?.putExtra("roomId", it)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 构建通知
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(senderName)
            .setContentText(messageContent)
            .setSmallIcon(getNotificationIcon(context))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(messageContent)
            )
            .build()

        // 显示通知
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(notificationId++, notification)
    }

    /**
     * 取消所有消息通知
     */
    fun cancelAllNotifications(context: Context) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancelAll()
    }

    /**
     * 获取通知图标
     */
    private fun getNotificationIcon(context: Context): Int {
        // 尝试使用应用图标
        val iconResId = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
        return if (iconResId != 0) iconResId else android.R.drawable.ic_dialog_info
    }
}

