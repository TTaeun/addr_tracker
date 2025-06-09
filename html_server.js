const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// JSON 파싱 미들웨어
app.use(express.json());
app.use(express.static('public'));

// 주소 파일 경로
const ADDRESSES_FILE = path.join(__dirname, 'addresses.json');

// 주소 목록 로드
function loadAddresses() {
    if (fs.existsSync(ADDRESSES_FILE)) {
        return JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
    }
    return [];
}

// 주소 목록 저장
function saveAddresses(addresses) {
    fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
}

// 주소 목록 조회
app.get('/api/addresses', (req, res) => {
    const addresses = loadAddresses();
    res.json(addresses);
});

// 주소 추가
app.post('/api/addresses', (req, res) => {
    const { category, name, address } = req.body;
    
    if (!category || !name || !address) {
        return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }
    
    const addresses = loadAddresses();
    
    // 중복 체크
    if (addresses.some(addr => addr.address === address)) {
        return res.status(400).json({ error: '이미 등록된 주소입니다.' });
    }
    
    addresses.push({ category, name, address });
    saveAddresses(addresses);
    
    res.json({ message: '주소가 추가되었습니다.', addresses });
});

// 주소 삭제
app.delete('/api/addresses/:address', (req, res) => {
    const { address } = req.params;
    const addresses = loadAddresses();
    
    const index = addresses.findIndex(addr => addr.address === address);
    if (index === -1) {
        return res.status(404).json({ error: '주소를 찾을 수 없습니다.' });
    }
    
    addresses.splice(index, 1);
    saveAddresses(addresses);
    
    res.json({ message: '주소가 삭제되었습니다.', addresses });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 