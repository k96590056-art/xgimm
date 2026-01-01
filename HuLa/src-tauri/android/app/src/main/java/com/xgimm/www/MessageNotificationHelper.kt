package com.xgimm.www

import android.content.Context

object MessageNotificationHelper {
    /**
     * 显示消息通知
     */
    @JvmStatic
    fun showNotification(
        context: Context,
        senderName: String,
        messageContent: String,
        roomId: String?
    ) {
        MessageNotificationService.showMessageNotification(
            context,
            senderName,
            messageContent,
            roomId
        )
    }

    /**
     * 取消所有通知
     */
    @JvmStatic
    fun cancelAllNotifications(context: Context) {
        MessageNotificationService.cancelAllNotifications(context)
    }
}

