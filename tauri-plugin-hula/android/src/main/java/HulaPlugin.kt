package com.plugin.hula

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke

@InvokeArg
class ShowNotificationArgs {
    var title: String? = null
    var body: String? = null
    var roomId: String? = null
    var fromUser: String? = null
    var notificationId: Int = 0
}

@InvokeArg
class CancelNotificationArgs {
    var notificationId: Int = 0
}

@TauriPlugin
class HulaPlugin(private val activity: Activity) : Plugin(activity) {
    private val MESSAGE_CHANNEL_ID = "hula_message_channel"
    private val MESSAGE_CHANNEL_NAME = "消息通知"
    private val BACKGROUND_CHANNEL_ID = "hula_background_channel"
    private val BACKGROUND_CHANNEL_NAME = "后台服务"
    private val BACKGROUND_NOTIFICATION_ID = 1001

    init {
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // 消息通知渠道
            val messageChannel = NotificationChannel(
                MESSAGE_CHANNEL_ID,
                MESSAGE_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "接收新消息通知"
                enableVibration(true)
                enableLights(true)
            }

            // 后台服务通知渠道
            val backgroundChannel = NotificationChannel(
                BACKGROUND_CHANNEL_ID,
                BACKGROUND_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "保持应用在后台运行以接收消息"
            }

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(messageChannel)
            notificationManager.createNotificationChannel(backgroundChannel)
        }
    }

    @Command
    fun showNotification(invoke: Invoke) {
        val args = invoke.parseArgs(ShowNotificationArgs::class.java)

        val notificationManager =
            activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // 创建点击通知的Intent，跳转到应用并传递roomId
        val packageManager = activity.packageManager
        val intent = packageManager.getLaunchIntentForPackage(activity.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("roomId", args.roomId)
            putExtra("fromUser", args.fromUser)
            putExtra("action", "open_chat")
        } ?: Intent(activity, activity.javaClass).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("roomId", args.roomId)
            putExtra("fromUser", args.fromUser)
            putExtra("action", "open_chat")
        }

        val pendingIntent = PendingIntent.getActivity(
            activity,
            args.notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(activity, MESSAGE_CHANNEL_ID)
            .setContentTitle(args.title ?: "新消息")
            .setContentText(args.body ?: "")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(args.notificationId, notification)

        val ret = JSObject()
        ret.put("success", true)
        ret.put("notificationId", args.notificationId)
        invoke.resolve(ret)
    }

    @Command
    fun cancelNotification(invoke: Invoke) {
        val args = invoke.parseArgs(CancelNotificationArgs::class.java)

        val notificationManager =
            activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(args.notificationId)

        val ret = JSObject()
        ret.put("success", true)
        invoke.resolve(ret)
    }

    @Command
    fun startBackgroundService(invoke: Invoke) {
        try {
            val intent = Intent(activity, BackgroundService::class.java).apply {
                action = BackgroundService.ACTION_START
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(intent)
            } else {
                activity.startService(intent)
            }

            val ret = JSObject()
            ret.put("success", true)
            invoke.resolve(ret)
        } catch (e: Exception) {
            invoke.reject("启动后台服务失败: ${e.message}")
        }
    }

    @Command
    fun stopBackgroundService(invoke: Invoke) {
        try {
            val intent = Intent(activity, BackgroundService::class.java).apply {
                action = BackgroundService.ACTION_STOP
            }
            activity.stopService(intent)

            val ret = JSObject()
            ret.put("success", true)
            invoke.resolve(ret)
        } catch (e: Exception) {
            invoke.reject("停止后台服务失败: ${e.message}")
        }
    }

    @Command
    fun getLaunchIntentData(invoke: Invoke) {
        try {
            val intent = activity.intent
            val ret = JSObject()
            
            val roomId = intent.getStringExtra("roomId")
            val fromUser = intent.getStringExtra("fromUser")
            val action = intent.getStringExtra("action")
            
            ret.put("roomId", roomId)
            ret.put("fromUser", fromUser)
            ret.put("action", action)
            ret.put("hasData", roomId != null || action != null)
            
            invoke.resolve(ret)
        } catch (e: Exception) {
            invoke.reject("获取启动Intent数据失败: ${e.message}")
        }
    }

    @Command
    fun clearLaunchIntentData(invoke: Invoke) {
        try {
            // 清除Intent中的额外数据，避免重复处理
            activity.intent.removeExtra("roomId")
            activity.intent.removeExtra("fromUser")
            activity.intent.removeExtra("action")
            
            val ret = JSObject()
            ret.put("success", true)
            invoke.resolve(ret)
        } catch (e: Exception) {
            invoke.reject("清除启动Intent数据失败: ${e.message}")
        }
    }
}

