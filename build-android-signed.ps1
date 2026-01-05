# 构建并签名 Android APK
# 证书: xgim.keystore, 密码: 111111, 别名: xgim

$ErrorActionPreference = "Stop"

Write-Host "=== 构建并签名 Android APK ===" -ForegroundColor Cyan
Write-Host "证书: xgim.keystore, 别名: xgim, 密码: 111111" -ForegroundColor Green
Write-Host ""

# 检查 keystore 文件
$keystorePath = Join-Path (Get-Location) "xgim.keystore"
if (-not (Test-Path $keystorePath)) {
    Write-Host "错误: 未找到 keystore 文件: $keystorePath" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 找到 keystore 文件" -ForegroundColor Green

# 步骤 1: 构建 APK
Write-Host ""
Write-Host "步骤 1/3: 构建 Android APK..." -ForegroundColor Yellow
Write-Host "正在执行: pnpm tauri android build" -ForegroundColor Gray
Write-Host ""

pnpm tauri android build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "构建失败，退出代码: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ 构建完成" -ForegroundColor Green

# 步骤 2: 查找生成的 APK
Write-Host ""
Write-Host "步骤 2/3: 查找 APK 文件..." -ForegroundColor Yellow

$apkPath = "src-tauri\target\android\gradle\app\build\outputs\apk"
$apkFiles = Get-ChildItem $apkPath -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue | 
    Where-Object { 
        ($_.FullName -match "universal" -or $_.FullName -match "release") -and
        $_.FullName -notmatch "unaligned" -and
        $_.FullName -notmatch "signed"
    }

if (-not $apkFiles) {
    Write-Host "错误: 未找到 APK 文件" -ForegroundColor Red
    Write-Host "请检查目录: $apkPath" -ForegroundColor Yellow
    exit 1
}

$apk = $apkFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "找到 APK: $($apk.Name)" -ForegroundColor Green
Write-Host "路径: $($apk.FullName)" -ForegroundColor Gray
Write-Host "文件大小: $([math]::Round($apk.Length/1MB, 2)) MB" -ForegroundColor Gray

# 步骤 3: 签名 APK
Write-Host ""
Write-Host "步骤 3/3: 签名 APK..." -ForegroundColor Yellow

# 对齐 APK（可选但推荐）
$alignedApk = $apk.FullName -replace '\.apk$', '-aligned.apk'
$zipalignPath = Get-Command zipalign -ErrorAction SilentlyContinue

$apkToSign = $apk.FullName
if ($zipalignPath) {
    Write-Host "对齐 APK..." -ForegroundColor Gray
    & zipalign -v -f 4 $apk.FullName $alignedApk 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $alignedApk)) {
        $apkToSign = $alignedApk
        Write-Host "✓ APK 对齐完成" -ForegroundColor Green
    } else {
        Write-Host "对齐失败，将直接签名原 APK" -ForegroundColor Yellow
    }
} else {
    Write-Host "未找到 zipalign，跳过对齐步骤" -ForegroundColor Yellow
}

# 签名 APK
$signedApk = $apkToSign -replace '(-aligned)?\.apk$', '-signed.apk'
Write-Host "使用 jarsigner 签名 APK..." -ForegroundColor Gray

& jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
    -keystore $keystorePath `
    -storepass 111111 `
    -keypass 111111 `
    $apkToSign xgim

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "签名失败，退出代码: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

# 如果使用了对齐的 APK，需要复制签名后的文件
if ($apkToSign -ne $apk.FullName -and (Test-Path $apkToSign)) {
    Copy-Item $apkToSign $signedApk -Force
}

Write-Host "✓ APK 签名完成" -ForegroundColor Green

# 验证签名
Write-Host ""
Write-Host "验证签名..." -ForegroundColor Yellow
& jarsigner -verify -verbose -certs $signedApk 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ APK 签名验证通过" -ForegroundColor Green
} else {
    Write-Host "警告: 签名验证失败" -ForegroundColor Yellow
}

# 输出结果
$signedApkInfo = Get-Item $signedApk
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ 构建并签名完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "已签名的 APK 位置：" -ForegroundColor Yellow
Write-Host "  $($signedApkInfo.FullName)" -ForegroundColor Cyan
Write-Host ""
Write-Host "文件大小: $([math]::Round($signedApkInfo.Length/1MB, 2)) MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "可以直接安装到设备或用于发布。" -ForegroundColor Gray
Write-Host ""

