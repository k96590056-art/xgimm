# Android 应用运行指南

## 前置要求

### 1. 安装 Rust 和 Cargo
```bash
# 访问 https://rustup.rs/ 下载并安装 Rust
# 或使用以下命令（Windows）:
# curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. 安装 Android SDK
- 安装 Android Studio
- 配置 ANDROID_HOME 环境变量
- 安装 Android SDK Platform 和 Build Tools

### 3. 安装 Tauri CLI
```bash
cargo install tauri-cli
# 或使用 npm:
npm install -g @tauri-apps/cli
```

## 运行步骤

### 步骤 1: 启动 Android 模拟器
1. 打开 Android Studio
2. 启动 AVD Manager
3. 启动模拟器（确保端口为 7555 或使用默认端口）

### 步骤 2: 连接模拟器
```bash
# 如果模拟器使用自定义端口（如 7555）:
adb connect 127.0.0.1:7555

# 检查连接状态:
adb devices
```

### 步骤 3: 运行应用

#### 方法 1: 使用 Cargo（推荐）
```bash
cd E:\Projects\xgims\HuLa\src-tauri
cargo tauri android dev
```

#### 方法 2: 使用 npm/pnpm
```bash
cd E:\Projects\xgims\HuLa
npx @tauri-apps/cli android dev
# 或
pnpm tauri android dev
```

#### 方法 3: 构建 APK 后安装
```bash
cd E:\Projects\xgims\HuLa\src-tauri
cargo tauri android build

# 安装到设备:
adb install -r src-tauri/target/android/debug/app-debug.apk
```

## 常见问题

### 1. 模拟器连接失败
- 确保模拟器已启动
- 检查端口是否正确（默认 5554）
- 尝试: `adb kill-server` 然后 `adb start-server`

### 2. Cargo 未找到
- 确保 Rust 已正确安装
- 检查 PATH 环境变量
- 重启终端或 IDE

### 3. Android SDK 未找到
- 设置 ANDROID_HOME 环境变量
- 确保已安装 Android SDK Platform-Tools

### 4. 构建失败
- 检查 Android SDK 版本
- 确保 Gradle 配置正确
- 查看错误日志

## 快速运行命令（如果环境已配置）

```bash
# 1. 连接模拟器
adb connect 127.0.0.1:7555

# 2. 进入项目目录
cd E:\Projects\xgims\HuLa\src-tauri

# 3. 运行开发模式
cargo tauri android dev
```

## 注意事项

- 首次运行可能需要较长时间（下载依赖）
- 确保网络连接正常（需要下载 Gradle 依赖）
- 建议使用 Android 8.0+ 的模拟器

