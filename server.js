const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 