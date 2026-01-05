@echo off
cd /d "%~dp0"
REM 限制并行编译任务数以减少内存使用
set CARGO_BUILD_JOBS=2

echo ========================================
echo Building Android APK (Debug - No signing required)...
echo ========================================
echo.

REM 先构建前端
echo Step 1: Building frontend...
call pnpm build
if %ERRORLEVEL% NEQ 0 (
    echo Frontend build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Stopping Kotlin daemon and cleaning build cache...
cd src-tauri\gen\android
if exist gradlew.bat (
    call gradlew.bat --stop >nul 2>&1
    REM 清理 Kotlin 增量编译缓存（解决路径问题）
    if exist "build\.kotlin" (
        rmdir /s /q "build\.kotlin" >nul 2>&1
    )
    if exist ".gradle" (
        if exist ".gradle\kotlin" (
            rmdir /s /q ".gradle\kotlin" >nul 2>&1
        )
    )
)
cd ..\..\..

echo.
echo Step 3: Building Android debug package (no signing required)...
echo.

REM 使用 Tauri 构建命令，这会处理整个构建流程
REM 构建 debug 版本的 APK（不需要签名）
REM --apk true 表示构建 APK，--debug 表示 debug 模式（不需要签名）
pnpm exec tauri android build --debug --apk true

set BUILD_RESULT=%ERRORLEVEL%

if %BUILD_RESULT% EQU 0 (
    echo.
    echo ========================================
    echo Android debug build completed successfully!
    echo ========================================
    echo Debug APK files should be in:
    echo   src-tauri\gen\android\app\build\outputs\apk\debug\
    echo.
    
    REM 列出生成的 APK 文件
    if exist "src-tauri\gen\android\app\build\outputs\apk\debug\*.apk" (
        echo Generated APK files:
        dir /b "src-tauri\gen\android\app\build\outputs\apk\debug\*.apk"
    )
) else (
    echo.
    echo ========================================
    echo Build failed with exit code: %BUILD_RESULT%
    echo ========================================
    echo.
    echo Trying alternative build method (direct Gradle build)...
    echo.
    
    cd src-tauri\gen\android
    REM 清理并重新构建
    call gradlew.bat clean assembleDebug --no-daemon --stacktrace
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ========================================
        echo Android debug build completed successfully!
        echo ========================================
        echo Debug APK files should be in:
        echo   app\build\outputs\apk\debug\
        echo.
        if exist "app\build\outputs\apk\debug\*.apk" (
            echo Generated APK files:
            dir /b "app\build\outputs\apk\debug\*.apk"
        )
    ) else (
        echo.
        echo ========================================
        echo Build failed. Check the errors above.
        echo ========================================
    )
    cd ..\..\..
)

echo.
pause

