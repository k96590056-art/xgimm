# 配置 WiX Toolset 到用户 PATH 环境变量

$wixPath = "F:\newProects\Tools\wix314"

# 检查 WiX 路径是否存在
if (-not (Test-Path $wixPath)) {
    Write-Host "错误: WiX 路径不存在: $wixPath" -ForegroundColor Red
    exit 1
}

# 获取当前用户 PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

# 检查 WiX 路径是否已在 PATH 中
if ($userPath -like "*$wixPath*") {
    Write-Host "WiX 路径已在用户 PATH 中" -ForegroundColor Yellow
} else {
    # 添加到用户 PATH
    $newPath = if ($userPath) { "$userPath;$wixPath" } else { $wixPath }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "WiX 路径已添加到用户 PATH: $wixPath" -ForegroundColor Green
}

# 刷新当前会话的 PATH
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

Write-Host ""
Write-Host "验证 WiX 安装:" -ForegroundColor Cyan
if (Test-Path "$wixPath\candle.exe") {
    Write-Host "  candle.exe: 存在" -ForegroundColor Green
    & "$wixPath\candle.exe" -? 2>&1 | Select-Object -First 3
} else {
    Write-Host "  candle.exe: 不存在" -ForegroundColor Red
}

Write-Host ""
Write-Host "配置完成！" -ForegroundColor Green
Write-Host "注意: 新打开的终端将自动包含 WiX 路径" -ForegroundColor Yellow



