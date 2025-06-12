require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const logger = require('./utils/logger');
const { getOrCreateTrId, deleteTrId } = require('./utils/security');
const {
    loadAddressesFromGAS,
    fetchOpenPositions,
    fetchPrice,
    sendTelegramNotification
} = require('./utils/http');
const { flushBufferToFile, readJsonFile } = require('./utils/file');


const STATE_FILE = path.join(__dirname, 'state.json');
const ADDRESSES_FILE = path.join(__dirname, 'addresses.json');
const FLUSH_INTERVAL = 60 * 60 * 1000; // 1시간

let historyBuffer = [];
let currentState = {};

if (fs.existsSync(STATE_FILE)) {
    currentState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}
let trIdMap = {}; // key: `${name}::${address}::${coin}`, value: trId
let addresses = [];

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

async function addHistoryAsync(entry) {
    historyBuffer.push(entry);
}

function flushHistory() {
    flushBufferToFile({
        buffer: historyBuffer,
        dir: path.join(__dirname, 'history'),
        filePrefix: '', // 또는 'history' 등 원하는 prefix
        date: new Date(),
        ext: 'json'
    });
    historyBuffer = [];
}

function mergeHistoryByDates(startDate, endDate) {
    const dir = path.join(__dirname, 'history');
    let merged = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10); // YYYY-MM-DD
        const filePath = path.join(dir, `${dateStr}.json`);
        const arr = readJsonFile(filePath);
        if (Array.isArray(arr)) {
            merged = merged.concat(arr);
        }
        current.setDate(current.getDate() + 1);
    }
    return merged;
}

// 메인 추적 함수
async function _start() {
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
            await sendTelegramNotification(process.env.BOT_TOKEN, process.env.CHAT_ID, message);

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
                deleteTrId(change.key);
            }
        }
    }
    
    // 현재 상태 저장
    currentState = newState;
    fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2));
    
    logger.info('Position tracking completed.');
}

function start() {
    // 1시간마다 flush
    setInterval(flushHistory, FLUSH_INTERVAL);
    // 서버 종료 시 flush
    process.on('exit', flushHistory);
    process.on('SIGINT', () => { flushHistory(); process.exit(); });
    // 매분마다 주소를 다시 로드하고 포지션 추적 시작
    cron.schedule('* * * * *', async () => {
        addresses = await loadAddressesFromGAS(process.env.GAS_URL);
        logger.info('Addresses reloaded', { addresses });
        await _start();
    });
}


module.exports = {
    start,
    mergeHistoryByDates,
};

