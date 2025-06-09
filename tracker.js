require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cron = require('node-cron');

// 상태 파일 경로
const STATE_FILE = path.join(__dirname, 'state.json');
const ADDRESSES_FILE = path.join(__dirname, 'addresses.json');

// 상태 초기화
let currentState = {};
if (fs.existsSync(STATE_FILE)) {
    currentState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

// 주소 목록 로드
let addresses = [];
if (fs.existsSync(ADDRESSES_FILE)) {
    addresses = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
}

// Hyperliquid API 호출 함수
async function fetchOpenPositions(address) {
    try {
        const requestBody = {
            type: "clearinghouseState",
            user: address.address
        };

        console.log('Request Body:', JSON.stringify(requestBody));

        const response = await fetch(`https://api.hyperliquid.xyz/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        return await response.json();
    } catch (error) {
        console.error(`Error fetching positions for ${address}:`, error);
        return [];
    }
}

// Telegram 알림 전송
async function sendTelegramNotification(message) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: process.env.CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
    }
}

// Google Sheets 업데이트
async function updateGoogleSheets(data) {
    try {
        const response = await fetch(process.env.GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating Google Sheets:', error);
    }
}

// 상태 비교 및 변경사항 감지
function detectChanges(oldState, newState) {
    const changes = [];
    
    // 새로운 포지션 확인
    for (const [key, value] of Object.entries(newState)) {
        if (!oldState[key]) {
            changes.push({
                type: 'NEW',
                key,
                value
            });
        } else if (JSON.stringify(oldState[key]) !== JSON.stringify(value)) {
            changes.push({
                type: 'UPDATE',
                key,
                oldValue: oldState[key],
                newValue: value
            });
        }
    }
    
    // 종료된 포지션 확인
    for (const key of Object.keys(oldState)) {
        if (!newState[key]) {
            changes.push({
                type: 'CLOSE',
                key,
                value: oldState[key]
            });
        }
    }
    
    return changes;
}

// 메인 추적 함수
async function trackPositions() {
    console.log('Starting position tracking...');
    const newState = {};
    
    for (const address of addresses) {
        const positions = await fetchOpenPositions(address);
        
        for (const  assetPosition of positions.assetPositions) {
            const position = assetPosition.position;
            if(!position) continue;

            const key = `${address.name}::${address.address}::${position.coin}`;
            newState[key] = {
                size: position.szi,
                entry: position.entryPx,
                liquidation: position.liquidationPx
            };
        }
    }
    
    // 변경사항 감지
    const changes = detectChanges(currentState, newState);
    
    // 변경사항이 있으면 알림 전송 및 시트 업데이트
    if (changes.length > 0) {
        for (const change of changes) {
            let message = '';
            switch (change.type) {
                case 'NEW':
                    message = `📥 ${change.key.split('::')[2]} ${change.value.size} 진입\n지갑: ${change.key.split('::')[1]}\n사이즈: ${change.value.size}\n진입가: ${change.value.entry}\n청산가: ${change.value.liquidation}`;
                    break;
                case 'UPDATE':
                    message = `⬆️ ${change.key.split('::')[2]} ${change.value.size} 수량 변경\n총: ${change.newValue.size}\n진입가: ${change.newValue.entry}\n청산가: ${change.newValue.liquidation}`;
                    break;
                case 'CLOSE':
                    message = `❌ ${change.key.split('::')[2]} 포지션 종료\n사이즈: ${change.value.size}\n진입가: ${change.value.entry}\n청산가: ${change.value.liquidation}`;
                    break;
            }
            await sendTelegramNotification(message);
        }
        
        // // Google Sheets 업데이트
        // await updateGoogleSheets({
        //     currentState: newState,
        //     changes: changes
        // });
    }
    
    // 현재 상태 저장
    currentState = newState;
    fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2));
    
    console.log('Position tracking completed.');
}

// 5분마다 실행
cron.schedule('*/5 * * * *', trackPositions);

// 초기 실행
trackPositions(); 