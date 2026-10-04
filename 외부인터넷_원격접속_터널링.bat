@echo off
chcp 65001 > nul
title 유니원 리햅 (UniRehab) - Cloudflare 외부 인터넷 원격 접속 터널링
echo ============================================================
echo   🌐 Cloudflare 초고속 글로벌 보안 터널을 생성합니다...
echo   * 경고창 및 비밀번호 없이 바로 열리는 보안 링크가 발급됩니다.
echo ============================================================
echo.
if exist "C:\Users\doyoo\cloudflared.exe" (
    C:\Users\doyoo\cloudflared.exe tunnel --protocol http2 --url http://localhost:3000
) else (
    echo cloudflared.exe 파일을 찾을 수 없습니다.
)
pause
