@echo off
chcp 65001 > nul
echo ========================================================
echo   Geditor - 윈도우 개발 및 디버그 모드 실행
echo ========================================================
echo.
echo Geditor를 실행합니다...
npm run tauri dev
if %errorlevel% neq 0 (
    echo.
    echo [오류] 실행 중 문제가 발생했습니다.
    echo Rust가 설치되어 있는지 확인해 주세요. (https://rustup.rs)
    pause
    exit /b %errorlevel%
)
