# Hyperliquid 지갑 추적 자동화 시스템 기획서 v.2.0

## 1. 개요

Hyperliquid 지갑 주소의 **열린 포지션(Open Position)** 정보를 5분 간격으로 추적하여 Google Spreadsheet에 기록하고, 이전 데이터와 비교해 **변경사항이 발생한 경우에만 Telegram으로 알림을 발송**하는 시스템을 기획한다. 데이터를 수집하는 서버는 Google Apps Script(GAS)를 통해 연동된다.

---

## 2. 보핵 개요

| 요소      | 구성                               |
| ------- | -------------------------------- |
| 기록 포맷   | Node.js 서버 + GAS 연동              |
| 추적 대상   | Hyperliquid API: 열린 포지션 정보       |
| 데이터 전송  | Google Apps Script (GAS) POST 수신 |
| 히스토리 저장 | Google Sheets                    |
| 변경 감지   | 이전 데이터와 비교하여 변경 시만 처리            |
| 알림 전송   | Telegram Bot API                 |
| 주기      | 5분마다 (cron job)                  |

---

## 3. 개발 방식

### 3.1 구조

```
hyper-position-tracker/
├── public/
│   └── index.html            ○ 지갑 주소 입력 UI (구분, 이름, 주소 입력 + 삭제 기능 포함)
├── addresses.json           ○ 추적 지갑 주소 목록 [{구분, 이름, 주소}]
├── server.js                ○ GAS 요청 처리 및 비교 로직 + 주소 추가/삭제 API
├── tracker.js               ○ 포지션 데이터 5분마다 요청
├── utils/
│   ├── fetchOpenPositions.js ○ Hyperliquid 포지션 API 요청
│   ├── sendTelegram.js      ○ Telegram 알림
│   └── sendToGAS.js         ○ GAS API 호출 모듈
├── .env                     ○ 환경변수 설정 (Telegram, GAS URL 등)
```

### 3.2 동작 시나리오

1. 사용자 HTML 페이지에서 지갑 주소, 이름, 구분 입력 후 제출
2. `addresses.json`에 `{구분, 이름, 주소}` 객체 추가
3. tracker.js가 5분마다 모든 주소에 대해 포지션 요청
4. Google Sheet에 저장된 이전 포지션 정보와 비교
5. 변경사항이 있을 경우:

   * GAS를 통해 Google Sheet에 `{시간, 구분, 이름, 주소, 포지션 정보}` 전송
   * Telegram으로 알림 발송
6. HTML 페이지에서 현재 등록된 주소 목록을 테이블로 노출하고, 삭제 버튼 제공하여 POST 요청으로 주소 제거 가능

---

## 4. API 구성

### Hyperliquid Open Position 조회

* API: `https://api.hyperliquid.xyz/info`
* POST Payload 예시:

```json
{
  "type": "openPositions",
  "user": "0x5078..."
}
```

### Google Apps Script 연동

* GAS WebApp URL로 POST 전송
* 전송 데이터: 시간, 구분, 이름, 주소, 종목, 포지션 방향, 사이즈, 진입가, 청산가 등

### Telegram 알림 조건

* 이전과 비교해 새로운 포지션이 생겼거나, 기존 포지션이 종료됐거나, 사이즈/가격 변경 시
* 메시지 포맷 예시:

```
📈 포지션 변경 알림
이름: 홍길동
종목: ETH-PERP
방향: 롱 → 숏
사이즈: 1.25 → 2.00
```

---

## 5. 시트 열 구성 예시

| 시간               | 구분 | 이름  | 지갑 주소     | 종목  | 방향   | 수량  | 진입가    | 청산가    | 상태     |
| ---------------- | -- | --- | --------- | --- | ---- | --- | ------ | ------ | ------ |
| 2025-06-05 13:00 | 주요 | 홍길동 | 0x5078... | ETH | Long | 2.0 | 2600.5 | 2450.0 | Active |

---

## 6. 실행 순서

1. `.env`에 BOT\_TOKEN, CHAT\_ID, GAS\_URL 설정
2. `node server.js` → 주소 등록 및 삭제 웹서버 실행
3. `node tracker.js` → 포지션 수집 및 변경 비교 실행

---

## 7. 확장 아이디어

* 시트에 포지션 유지시간, 실현 PnL 연산 칼럼 추가
* 특정 종목 필터링 (예: ETH만 추적)
* 종료 포지션은 별도 탭으로 분리 백업

---

## 8. 요약

* GAS를 통해 Google Spreadsheet에 실시간 기록 유지
* 거래 발생/변경 시에만 Telegram으로 알림
* HTML UI를 통해 구분, 이름, 주소 등록 및 삭제 가능
* 수동 확인을 줄이고 자동화된 분석 기반 제공
