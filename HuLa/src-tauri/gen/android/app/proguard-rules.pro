# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ==================== HuLa 自定义类保留规则 ====================
# 保留 KeepAlive 服务相关类
-keep class com.xgimm.www.KeepAliveService { *; }
-keep class com.xgimm.www.KeepAliveHelper { *; }

# 保留开机自启动接收器
-keep class com.xgimm.www.BootReceiver { *; }

# 保留消息通知相关类
-keep class com.xgimm.www.MessageNotificationHelper { *; }
-keep class com.xgimm.www.MessageNotificationService { *; }

# 保留 MainActivity
-keep class com.xgimm.www.MainActivity { *; }

# 保留所有 generated 目录下的类
-keep class com.xgimm.www.generated.** { *; }