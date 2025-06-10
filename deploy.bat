@echo off
echo ===== 배포 시작 =====

:: 작업 디렉토리로 이동
cd /d C:\path\to\addr_tracker

:: Git 변경사항 가져오기
echo Git 변경사항 가져오는 중...
git pull origin main

:: 의존성 패키지 설치
echo 의존성 패키지 설치 중...
call npm install

:: PM2로 서버 재시작
echo 서버 재시작 중...
call pm2 restart all

echo ===== 배포 완료 =====
pause 