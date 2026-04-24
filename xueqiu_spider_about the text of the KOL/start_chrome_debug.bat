@echo off
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 https://xueqiu.com/S/SH600519
echo Chrome launched with debug port 9222
echo.
echo Please wait 5 seconds, then verify:
echo 1. Chrome opens with debug port
echo 2. You are logged in to xueqiu.com
echo.
timeout /t 3
