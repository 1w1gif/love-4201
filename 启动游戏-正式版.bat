@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

echo ============================================
echo   4201爱情故事 - 正式版（更快更稳定）
echo ============================================
echo.
echo 正在启动服务器，请稍候几秒...

rem 服务器就绪后自动用默认浏览器打开游戏
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3000"

cd /d "%~dp0apps\web"
node "%~dp0node_modules\next\dist\bin\next" start -p 3000

echo.
echo 服务器已停止。按任意键关闭窗口。
pause >nul
