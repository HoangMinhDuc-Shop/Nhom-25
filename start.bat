@echo off
chcp 65001 > nul
title Khoi dong He thong Quan ly Cu dan Chung cu co Tich hop AI - Nhom 25
echo ======================================================================
echo    HE THONG QUAN LY CU DAN CHUNG CU CO TICH HOP AI (NHOM 25)
echo    Giang vien huong dan: Thay Nguyen Tuan Anh
echo ======================================================================
echo.

REM Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] May tinh cua ban chua cai dat Node.js!
    echo Vui long tai va cai dat Node.js tai: https://nodejs.org
    pause
    exit /b
)

REM Kiem tra node_modules, neu chua co thi tu dong chay npm install
if not exist "node_modules" (
    echo [*] Phat hien chua co thu vien node_modules.
    echo [*] Dang tu dong chay npm install de tai cac goi thu vien can thiet...
    call npm install
    echo [*] Cai dat thu vien hoan tat!
    echo.
)

REM Khoi dong ung dung web
echo [*] Dang khoi dong Web server tai cong 3000...
echo [*] Mo trinh duyet truy cap: http://localhost:3000
echo.
echo ======================================================================
echo    Tai khoan dang nhap demo:
echo    - Ban Quan Ly: admin / admin123
echo    - Ke toan:     ketoan@chungcu.vn / ketoan123
echo    - Cu dan:      0912345678 / cudan123
echo ======================================================================
echo.

node server.js
pause
