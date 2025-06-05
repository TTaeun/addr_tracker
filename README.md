# Hyperliquid 지갑 추적 자동화 시스템

## 개요

이 프로젝트는 Hyperliquid 지갑 주소의 열린 포지션 정보를 5분 간격으로 추적하여 Google Spreadsheet에 기록하고, 변경사항이 발생할 경우 Telegram으로 알림을 발송하는 시스템입니다.

## 설치 및 실행 방법

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd addr_trackerv2
```

### 2. 의존성 설치
```bash
npm install express node-cron
```

### 3. 환경 변수 설정
`.env` 파일을 생성하고 다음과 같은 환경 변수를 설정합니다:
```
BOT_TOKEN=<your-telegram-bot-token>
CHAT_ID=<your-telegram-chat-id>
GAS_URL=<your-gas-webapp-url>
```

### 4. 서버 실행
`server.js` 파일을 실행하여 주소 등록 및 삭제 웹서버를 시작합니다:
```bash
node server.js
```

### 5. 포지션 추적기 실행
`tracker.js` 파일을 실행하여 5분마다 포지션을 추적합니다:
```bash
node tracker.js
```

## 설치된 패키지

다음은 이 프로젝트에서 사용된 주요 패키지 목록입니다:

- **express**: 웹 서버를 구축하기 위한 프레임워크입니다.
- **node-cron**: 주기적인 작업을 스케줄링하기 위한 패키지입니다.
- **node-fetch**: 서버 측에서 HTTP 요청을 수행하기 위한 패키지입니다.
- **dotenv**: 환경 변수를 로드하기 위한 패키지입니다.

이 패키지들은 `package.json` 파일의 `dependencies` 섹션에 정의되어 있으며, 프로젝트의 기능을 구현하는 데 사용됩니다.

## 기능

- **HTML 페이지**: 지갑 주소, 이름, 구분을 입력하고 등록된 주소 목록을 관리할 수 있는 UI 제공
- **주소 추가/삭제 API**: 서버를 통해 주소를 추가하거나 삭제할 수 있는 API 제공
- **포지션 추적**: Hyperliquid API를 통해 5분마다 포지션 정보를 확인하고 변경사항을 처리
- **Telegram 알림**: 포지션 변경 시 Telegram으로 알림 발송

## 확장 아이디어

- 포지션 유지시간 및 실현 PnL 연산 추가
- 특정 종목 필터링 기능 추가
- 종료 포지션을 별도 탭으로 분리하여 백업

## 기여

기여를 원하신다면, 이슈를 생성하거나 풀 리퀘스트를 제출해 주세요. 감사합니다! 