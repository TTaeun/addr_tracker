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
let addresses = [];
if (fs.existsSync(STATE_FILE)) {
    currentState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

// 주소 목록 로드
async function loadAddresses() {
    try {
        const response = await fetch(process.env.GAS_URL); // GAS 웹 앱 URL
        if (!response.ok) {
            throw new Error('Failed to fetch addresses from Google Sheets');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading addresses:', error);
        return [];
    }
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
        } else if (oldState[key].size !== value.size) {
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
    
    for (const val of addresses) {
        const address = val.address;
        const name = val.name;
        const positions = await fetchOpenPositions(address);
        
        for (const val of positions.assetPositions) {
            const position = val.position;
            const coin = position.coin;
            const key = `${name}::${address}::${coin}`;
            newState[key] = {
                size: Math.floor(position.szi * 100) / 100,
                leverage: position.maxLeverage,
                entry: Math.floor(position.entryPx * 100) / 100,
                liquidation: Math.floor(position.liquidationPx * 100) / 100
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
                    message = `NEW\n ${name}의 ${coin} lev: ${change.value.leverage}\nsize: ${change.value.size}\nprice: ${change.value.entry}, liqPx: ${change.value.liquidation}\n`;
                    break;
                case 'UPDATE':
                    // message = `UPDATE\n ${name}의 ${coin} lev: ${change.value.leverage}\nsize: ${change.value.size}\nprice: ${change.value.entry}, liqPx: ${change.value.liquidation}\n`;
                    message = `UPDATE\n ${name}의 ${coin}\n이전: ${change.value.size}\n현재: ${change.newValue.size}`;
                    break;
                case 'CLOSE':
                    message = `❌ ${name}의 ${coin} 포지션 종료`;
                    break;
            }
            await sendTelegramNotification(message);
        }
    }
    
    // 현재 상태 저장
    currentState = newState;
    fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2));
    
    logger.info('Position tracking completed.');
}

async function start() {
    addresses = await loadAddresses();
    logger.info('Addresses reloaded', { addresses });
    trackPositions();
}

// 5분마다 주소를 다시 로드하고 포지션 추적 시작
cron.schedule('*/5 * * * *', start);