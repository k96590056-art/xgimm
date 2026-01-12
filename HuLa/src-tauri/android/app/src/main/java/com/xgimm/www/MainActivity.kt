package com.xgimm.www

import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // 关键：让系统处理 IME（键盘）insets，同时保持 edge-to-edge 效果
        setupKeyboardHandling()

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

    /**
     * 设置键盘处理
     * 当 enableEdgeToEdge() 启用时，需要手动处理 IME insets
     *
     * 关键点：
     * 1. 监听 IME + 系统栏 insets
     * 2. 当键盘弹出时，调整内容区域的 margin 或 padding
     * 3. 确保 WebView 内容不被键盘遮挡
     */
    private fun setupKeyboardHandling() {
        val contentView = findViewById<FrameLayout>(android.R.id.content)

        // 获取 WebView 容器（通常是 content 的第一个子 View）
        contentView.post {
            val webViewContainer = if (contentView.childCount > 0) {
                contentView.getChildAt(0)
            } else {
                null
            }

            ViewCompat.setOnApplyWindowInsetsListener(contentView) { view, windowInsets ->
                val imeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime())
                val imeInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
                val systemBarsInsets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())

                // 计算底部空间：键盘高度或系统导航栏高度
                val bottomInset = if (imeVisible && imeInsets.bottom > 0) {
                    imeInsets.bottom
                } else {
                    systemBarsInsets.bottom
                }

                // 方法1：设置 content view 的 padding（影响子 View 的绘制区域）
                view.updatePadding(
                    left = systemBarsInsets.left,
                    top = systemBarsInsets.top,
                    right = systemBarsInsets.right,
                    bottom = bottomInset
                )

                // 方法2：如果有 WebView 容器，也调整其 margin
                webViewContainer?.let { container ->
                    container.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                        bottomMargin = bottomInset
                        topMargin = systemBarsInsets.top
                        leftMargin = systemBarsInsets.left
                        rightMargin = systemBarsInsets.right
                    }
                }

                android.util.Log.d("MainActivity", "Keyboard visible: $imeVisible, IME bottom: ${imeInsets.bottom}, bottomInset: $bottomInset, webViewContainer: ${webViewContainer?.javaClass?.simpleName}")

                // 返回消费后的 insets
                WindowInsetsCompat.CONSUMED
            }

            // 请求初始 insets 更新
            ViewCompat.requestApplyInsets(contentView)
        }
    }
}
