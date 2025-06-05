require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cron = require('node-cron');

const addressesFilePath = path.join(__dirname, 'addresses.json');

// Load addresses from file
function loadAddresses() {
    if (fs.existsSync(addressesFilePath)) {
        const data = fs.readFileSync(addressesFilePath);
        return JSON.parse(data);
    }
    return [];
}

// Function to fetch open positions from Hyperliquid API
async function fetchOpenPositions(address) {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clearinghouseState', user: address })
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Failed to parse JSON: ${text}`);
    }
}

async function sendToGAS(data) {
    
    const gasUrl = process.env.GAS_URL;
    console.log('GAS URL:', gasUrl);

    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('Response status:', response.status);  // 응답 상태 코드 출력
        if (!response.ok) {
            throw new Error(`Failed to send data to GAS: ${response.statusText}`);
        }
        console.log('Data sent to GAS successfully');
    } catch (error) {
        console.error('Error sending data to GAS:', error);
    }
}

// Function to check positions every 5 minutes
async function checkPositions() {
    const addresses = loadAddresses();
    for (const { category, name, address } of addresses) {
        try {
            const positions = await fetchOpenPositions(address);
            console.log(`Positions for ${address}:`, positions);
            // Send position data to GAS with category and name
            await sendToGAS({ category, name, address, positions });
            // Compare with previous positions and handle changes
        } catch (error) {
            console.error(`Error fetching positions for ${address}:`, error);
        }
    }
}

// // Schedule the task to run every 5 minutes
// cron.schedule('*/5 * * * *', () => {
//     checkPositions();
// });

// Schedule the task to run every 30 seconds
cron.schedule('*/30 * * * * *', () => {
    checkPositions();
});


// Initial run
checkPositions(); 