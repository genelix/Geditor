@echo off
chcp 65001 > nul
echo ========================================================
echo   Geditor - 윈도우 배포용 실행 파일 빌드 (.exe / Installer)
echo ========================================================
echo.
echo [1/2] 프론트엔드 에셋 빌드 중...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [오류] 프론트엔드 빌드에 실패했습니다.
    pause
    exit /b %errorlevel%
)
echo.
echo [2/2] Rust 코어 및 윈도우 실행 파일 (.exe) 빌드 중...
call npm run tauri build
if %errorlevel% neq 0 (
    echo.
    echo [오류] Tauri 윈도우 빌드에 실패했습니다.
    echo C++ Build Tools 및 Rust 환경을 확인해 주세요.
    pause
    exit /b %errorlevel%
)
echo.
echo ========================================================
echo   [성공] 윈도우용 Geditor 빌드가 성공적으로 완료되었습니다!
echo.
echo   - 단독 실행 파일 (.exe):
echo     src-tauri\target\release\geditor.exe
echo.
echo   - 윈도우 설치 프로그램 (NSIS Installer):
echo     src-tauri\target\release\bundle\nsis\
echo ========================================================
echo.
pause
