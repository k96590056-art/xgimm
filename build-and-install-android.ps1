# 构建并安装 Android APK 到 ADB 设备（端口 7555）
# 证书: xgim.keystore, 密码: 111111

$ErrorActionPreference = "Stop"

# 设置 ADB 路径
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:Path"

# 检查 ADB
$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbPath) {
    Write-Host "错误: 未找到 ADB，请确保 Android SDK Platform Tools 已安装" -ForegroundColor Red
    exit 1
}

Write-Host "=== 连接设备 ===" -ForegroundColor Cyan
& adb connect 127.0.0.1:7555
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "=== 检查设备连接 ===" -ForegroundColor Cyan
& adb devices

Write-Host ""
Write-Host "=== 查找 APK 文件 ===" -ForegroundColor Cyan

# 先查找已存在的 APK
$apkPath = "src-tauri\target\android\gradle\app\build\outputs\apk"
$apkFiles = Get-ChildItem $apkPath -Recurse -Filter "*universal*.apk" -ErrorAction SilentlyContinue

if (-not $apkFiles) {
    Write-Host "未找到已构建的 APK，开始构建..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "=== 构建 Android APK ===" -ForegroundColor Cyan
    Write-Host "使用证书: xgim.keystore" -ForegroundColor Green
    Write-Host ""
    
    # 构建 APK
    pnpm tauri android build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "构建失败，退出代码: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "=== 查找构建的 APK ===" -ForegroundColor Cyan
    
    # 重新查找 APK
    $apkFiles = Get-ChildItem $apkPath -Recurse -Filter "*universal*.apk" -ErrorAction SilentlyContinue
    
    if (-not $apkFiles) {
        Write-Host "错误: 未找到 universal APK 文件" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "找到已构建的 APK 文件" -ForegroundColor Green
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

# 对齐 APK（可选，但推荐）
$alignedApk = $apk.FullName -replace '\.apk$', '-aligned.apk'
if (Get-Command zipalign -ErrorAction SilentlyContinue) {
    Write-Host "对齐 APK..."
    & zipalign -v 4 $apk.FullName $alignedApk
    if ($LASTEXITCODE -eq 0) {
        $apkToSign = $alignedApk
    } else {
        $apkToSign = $apk.FullName
    }
} else {
    $apkToSign = $apk.FullName
}

# 签名 APK（如果尚未签名）
$signedApk = $apkToSign
$apkName = [System.IO.Path]::GetFileNameWithoutExtension($apkToSign)

# 检查是否已经签名
$isSigned = $apkName -match "signed"
if (-not $isSigned) {
    $signedApk = $apkToSign -replace '\.apk$', '-signed.apk'
    Write-Host "签名 APK: $apkToSign" -ForegroundColor Yellow
    & jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore $keystorePath -storepass 111111 -keypass 111111 $apkToSign xgim
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "签名失败，退出代码: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
    
    # 如果使用了对齐的 APK，复制已签名的版本
    if ($apkToSign -ne $apk.FullName) {
        Copy-Item $apkToSign $signedApk -Force
    }
    
    Write-Host "APK 签名完成: $signedApk" -ForegroundColor Green
} else {
    Write-Host "APK 已签名，使用: $signedApk" -ForegroundColor Green
}

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

