package com.xgimm.www

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // 启动保活服务
        try {
            KeepAliveService.startService(this)
            android.util.Log.i("MainActivity", "KeepAliveService started successfully")
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to start KeepAliveService: ${e.message}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // 服务会自动重启（START_STICKY），所以这里不需要停止
    }
}
