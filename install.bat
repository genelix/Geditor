@echo off
chcp 65001 > nul
echo ========================================================
echo   Geditor - 의존성 패키지 설치 (npm install)
echo ========================================================
echo.
npm install
if %errorlevel% neq 0 (
    echo.
    echo [오류] npm 패키지 설치에 실패했습니다.
    echo Node.js가 설치되어 있는지 확인해 주세요. (https://nodejs.org)
    pause
    exit /b %errorlevel%
)
echo.
echo [성공] 의존성 패키지 설치가 완료되었습니다!
echo 'dev.bat'을 실행하여 즉시 앱을 실행하거나, 'build.bat'으로 배포용 실행 파일을 만드세요.
echo.
pause
