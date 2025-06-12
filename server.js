const express = require('express');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const tracker = require('./tracker');
const logger = require('./utils/logger');


const app = express();
const PORT = process.env.PORT || 3000;

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
    const data = tracker.mergeHistoryByDates(start, end);
    res.json(data);
});

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    tracker.start();
}); 