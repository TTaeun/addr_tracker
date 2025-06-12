require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cron = require('node-cron');
const logger = require('./utils/logger');
const { v4: uuidv4 } = require('uuid'); // npm install uuid
const trIdMap = {}; // key: `${name}::${address}::${coin}`, value: trId

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

const HISTORY_FILE = path.join(__dirname, 'history.json');
let historyBuffer = [];
const FLUSH_INTERVAL = 60 * 60 * 1000; // 1시간

async function addHistoryAsync(entry) {
    historyBuffer.push(entry);
}

function flushHistory() {
    if (historyBuffer.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dir = path.join(__dirname, 'history');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const HISTORY_FILE = path.join(dir, `${dateStr}.json`);
    let historyArr = [];
    if (fs.existsSync(HISTORY_FILE)) {
        try {
            historyArr = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        } catch (e) {
            historyArr = [];
        }
    }
    historyArr = historyArr.concat(historyBuffer);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyArr, null, 2));
    historyBuffer = [];
    console.log(`[history] Flushed ${historyArr.length} entries to ${HISTORY_FILE}`);
}

// 1시간마다 flush
setInterval(flushHistory, FLUSH_INTERVAL);

// 서버 종료 시 flush
process.on('exit', flushHistory);
process.on('SIGINT', () => { flushHistory(); process.exit(); });

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
            const [name, address, coin] = change.key.split('::');
            const trId = getOrCreateTrId(change.key, change.type);

            let message = '';
            switch (change.type) {
                case 'NEW':
                    message = `NEW\n ${name}의 ${coin} lev: ${change.value.leverage}\nsize: ${change.value.size}\nprice: ${change.value.entry}, liqPx: ${change.value.liquidation}\n`;
                    break;
                case 'UPDATE':
                    message = `UPDATE\n ${name}의 ${coin}\n이전: ${change.value.size}\n현재: ${change.newValue.size}`;
                    break;
                case 'CLOSE':
                    message = `❌ ${name}의 ${coin} 포지션 종료`;
                    break;
            }
            await sendTelegramNotification(message);

            const entry = {
                trId,
                timestamp: Date.now(),
                type: change.type,
                name,
                address,
                coin,
                value: {
                    size: change.type === 'UPDATE' ? (change.newValue.size - change.oldValue.size).toString() : change.value.size
                }
            };

            if (change.type === 'UPDATE' || change.type === 'CLOSE') {
                entry.value.price = await fetchPrice(coin, Date.now());
            } else {
                entry.value.entry = change.value.entry;
            }

            await addHistoryAsync(entry);

            // CLOSE면 trIdMap에서 삭제(선택)
            if (change.type === 'CLOSE') {
                delete trIdMap[change.key];
            }
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

// 매분마다 주소를 다시 로드하고 포지션 추적 시작
cron.schedule('* * * * *', start);

async function fetchPrice(coin, timestamp) {
    try {
        // 예시: Hyperliquid의 kline(캔들) API 사용 (1분봉)
        const end = Math.floor(timestamp / 1000); // 초 단위
        const start = end - 60; // 1분 전
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "candleSnapshot",
                coin: coin,
                interval: "1m",
                startTime: start,
                endTime: end
            })
        });
        const data = await response.json();
        // data 구조에 따라 종가(close) 추출
        // 예: [{ close: "1234.5", ... }]
        if (Array.isArray(data) && data.length > 0) {
            return data[data.length - 1].close;
        }
    } catch (e) {
        console.error('fetchClosePrice error:', e);
    }
    return null;
}

function getOrCreateTrId(key, type) {
    if (type === 'NEW' || !trIdMap[key]) {
        trIdMap[key] = uuidv4();
    }
    return trIdMap[key];
}

