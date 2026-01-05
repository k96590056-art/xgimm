# MSI 构建脚本 - 包含代码签名配置
# 证书文件: src-tauri/code-signing.pfx
# 证书密码: 111111

# 设置代码签名环境变量
$pfxPath = Join-Path (Get-Location) "src-tauri\code-signing.pfx"
$pfxPassword = "111111"

# Tauri 2.0 代码签名配置
$env:TAURI_SIGNING_CERTIFICATE_PATH = $pfxPath
$env:TAURI_SIGNING_CERTIFICATE_PASSWORD = $pfxPassword
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $pfxPassword

# 对于 Windows，Tauri 可能还需要私钥路径
# 如果 PFX 文件包含私钥，可以直接使用 PFX 路径作为私钥路径
$env:TAURI_SIGNING_PRIVATE_KEY = $pfxPath

Write-Host "代码签名环境变量已设置:"
Write-Host "  证书路径: $env:TAURI_SIGNING_CERTIFICATE_PATH"
Write-Host "  证书密码: ***"

# 检查证书文件是否存在
$certPath = Join-Path (Get-Location) "src-tauri\code-signing.pfx"
if (Test-Path $certPath) {
    Write-Host "证书文件存在: $certPath" -ForegroundColor Green
} else {
    Write-Host "警告: 证书文件不存在: $certPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "开始构建 MSI 安装包..." -ForegroundColor Cyan
Write-Host ""

# 执行 MSI 构建
pnpm tauri build --bundles msi
