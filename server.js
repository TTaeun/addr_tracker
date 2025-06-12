const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

function mergeHistoryByDates(startDate, endDate) {
    const dir = path.join(__dirname, 'history');
    let merged = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10); // YYYY-MM-DD
        const filePath = path.join(dir, `${dateStr}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                merged = merged.concat(arr);
            } catch (e) {
                // 파일 파싱 에러 무시
            }
        }
        current.setDate(current.getDate() + 1);
    }
    return merged;
}

// state.json 반환 API
app.get('/api/state', (req, res) => {
    const stateFile = path.join(__dirname, 'state.json');
    if (fs.existsSync(stateFile)) {
        const data = fs.readFileSync(stateFile, 'utf8');
        res.type('application/json').send(data);
    } else {
        res.status(404).json({ error: 'state.json 파일이 존재하지 않습니다.' });
    }
});

// Express 예시
app.get('/api/history', (req, res) => {
    const { start, end } = req.query; // YYYY-MM-DD
    const data = mergeHistoryByDates(start, end);
    res.json(data);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 