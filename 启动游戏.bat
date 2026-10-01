@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

echo ============================================
echo   4201爱情故事 - 本地启动器
echo ============================================
echo.
echo 正在启动游戏服务器，请稍等几秒...

rem 6 秒后自动用默认浏览器打开游戏
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

npm run dev

echo.
echo 服务器已停止。按任意键关闭窗口。
pause >nul
