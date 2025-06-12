const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// GAS 주소 목록 로드
async function loadAddressesFromGAS(gasUrl) {
    try {
        const response = await fetch(gasUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch addresses from Google Sheets');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading addresses:', error);
        return [];
    }
}

// Hyperliquid 포지션 조회
async function fetchOpenPositions(address) {
    try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "clearinghouseState",
                user: address
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching positions:', error);
        return [];
    }
}

// Hyperliquid 가격 조회
async function fetchPrice(coin, timestamp) {
    try {
        const end = timestamp; // 그대로 사용 (밀리초)
        const start = end - 60_000; // 1분 전 (60초 * 1000ms)

        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "candleSnapshot",
                req: {
                    coin: coin,
                    interval: "1m",
                    startTime: start,   // 밀리초
                    endTime: end        // 밀리초
                }
            })
        });

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            return data[data.length - 1].c;
        }
    } catch (e) {
        console.error('fetchPrice error:', e);
    }
    return null;
}


// 텔레그램 메시지 전송
async function sendTelegramNotification(botToken, chatId, message) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
    }
}

module.exports = {
    loadAddressesFromGAS,
    fetchOpenPositions,
    fetchPrice,
    sendTelegramNotification
}; 