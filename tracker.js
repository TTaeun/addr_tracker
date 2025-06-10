require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cron = require('node-cron');
const logger = require('./utils/logger');

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
        logger.info(`Fetching positions for address: ${address}`);
        const response = await fetch(`https://api.hyperliquid.xyz/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "clearinghouseState",
                user: address
            })
        });
        const data = await response.json();
        logger.debug(`Positions data for ${address}:`, { data });
        return data;
    } catch (error) {
        logger.error(`Error fetching positions for ${address}:`, { error: error.message, stack: error.stack });
        return [];
    }
}

// Telegram 알림 전송
async function sendTelegramNotification(message) {
    try {
        logger.info('Sending Telegram notification', { message });
        const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: process.env.CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        const result = await response.json();
        logger.debug('Telegram notification sent', { result });
        return result;
    } catch (error) {
        logger.error('Error sending Telegram notification:', { error: error.message, stack: error.stack });
    }
}

// Google Sheets 업데이트
async function updateGoogleSheets(data) {
    try {
        logger.info('Updating Google Sheets', { data });
        const response = await fetch(process.env.GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        logger.debug('Google Sheets updated', { result });
        return result;
    } catch (error) {
        logger.error('Error updating Google Sheets:', { error: error.message, stack: error.stack });
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
    logger.info('Starting position tracking...');
    const newState = {};
    
    for (const address of addresses) {
        const positions = await fetchOpenPositions(address);
        
        for (const position of positions) {
            const key = `${address.name}::${address.address}::${position.coin}`;
            newState[key] = {
                side: position.side,
                sz: position.sz,
                entry: position.entry,
                liquidation: position.liquidation
            };
        }
    }
    
    // 변경사항 감지
    const changes = detectChanges(currentState, newState);
    logger.info('Changes detected', { changes });
    
    // 변경사항이 있으면 알림 전송 및 시트 업데이트
    if (changes.length > 0) {
        for (const change of changes) {
            let message = '';
            const [name, address, coin] = change.key.split('::');
            
            switch (change.type) {
                case 'NEW':
                    message = `📥 ${name}의 ${coin} ${change.value.side} 진입\n지갑: ${address}\n사이즈: ${change.value.sz}`;
                    break;
                case 'UPDATE':
                    message = `⬆️ ${name}의 ${coin} ${change.value.side} 수량 변경\n총: ${change.newValue.sz}`;
                    break;
                case 'CLOSE':
                    message = `❌ ${name}의 ${coin} 포지션 종료`;
                    break;
            }
            await sendTelegramNotification(message);
        }
        
        // Google Sheets 업데이트
        // await updateGoogleSheets({
        //     currentState: newState,
        //     changes: changes
        // });
    }
    
    // 현재 상태 저장
    currentState = newState;
    fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2));
    
    logger.info('Position tracking completed.');
}

// 5분마다 실행
cron.schedule('*/5 * * * *', trackPositions);

// 초기 실행
trackPositions(); 