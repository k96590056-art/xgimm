# 签名并安装 Android APK 到 ADB 设备（端口 7555）
# 证书: xgim.keystore, 密码: 111111

$ErrorActionPreference = "Stop"

# 设置 ADB 路径
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:Path"

# 检查 ADB
$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbPath) {
    Write-Host "错误: 未找到 ADB" -ForegroundColor Red
    exit 1
}

Write-Host "=== 连接设备 ===" -ForegroundColor Cyan
& adb connect 127.0.0.1:7555
Start-Sleep -Seconds 1
& adb devices

Write-Host ""
Write-Host "=== 查找 APK 文件 ===" -ForegroundColor Cyan

# 查找 universal APK
$apkPath = "src-tauri\target\android\gradle\app\build\outputs\apk"
$apkFiles = Get-ChildItem $apkPath -Recurse -Filter "*universal*.apk" -ErrorAction SilentlyContinue

if (-not $apkFiles) {
    Write-Host "错误: 未找到 APK 文件，请先构建: pnpm tauri android build" -ForegroundColor Red
    exit 1
}

$apk = $apkFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "找到 APK: $($apk.FullName)" -ForegroundColor Green
Write-Host "文件大小: $([math]::Round($apk.Length/1MB, 2)) MB" -ForegroundColor Green

Write-Host ""
Write-Host "=== 使用 xgim.keystore 签名 APK ===" -ForegroundColor Cyan

# 检查 keystore
$keystorePath = "xgim.keystore"
if (-not (Test-Path $keystorePath)) {
    Write-Host "错误: 未找到 keystore 文件: $keystorePath" -ForegroundColor Red
    exit 1
}

# 签名 APK
$signedApk = $apk.FullName -replace '\.apk$', '-signed.apk'
Write-Host "签名 APK..." -ForegroundColor Yellow
& jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore $keystorePath -storepass 111111 -keypass 111111 $apk.FullName xgim

if ($LASTEXITCODE -ne 0) {
    Write-Host "签名失败，退出代码: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Copy-Item $apk.FullName $signedApk -Force
Write-Host "APK 签名完成: $signedApk" -ForegroundColor Green

Write-Host ""
Write-Host "=== 安装 APK 到设备 ===" -ForegroundColor Cyan
& adb -s 127.0.0.1:7555 install -r $signedApk

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "APK 安装成功！" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "APK 安装失败，退出代码: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

