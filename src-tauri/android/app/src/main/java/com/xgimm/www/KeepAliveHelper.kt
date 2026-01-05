package com.xgimm.www

import android.content.Context
import androidx.appcompat.app.AppCompatActivity

object KeepAliveHelper {
    /**
     * 启动保活服务
     */
    @JvmStatic
    fun startKeepAlive(context: Context) {
        KeepAliveService.startService(context)
    }
    
    /**
     * 停止保活服务
     */
    @JvmStatic
    fun stopKeepAlive(context: Context) {
        KeepAliveService.stopService(context)
    }
}

