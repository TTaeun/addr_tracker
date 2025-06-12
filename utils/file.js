const fs = require('fs');
const path = require('path');

// 파일 읽기 (JSON)
function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return null;
    }
}

// 파일 쓰기 (JSON)
function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 버퍼 flush (배열을 파일에 append, 일별 파일 관리)
function flushBufferToFile({
    buffer,
    dir,
    filePrefix = '', // 예: 'history', 'states' 등
    date = new Date(),
    ext = 'json'
}) {
    if (!buffer || buffer.length === 0) return;
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fileName = filePrefix ? `${filePrefix}_${dateStr}.${ext}` : `${dateStr}.${ext}`;
    const filePath = path.join(dir, fileName);
    let arr = [];
    if (fs.existsSync(filePath)) {
        try {
            arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            arr = [];
        }
    }
    arr = arr.concat(buffer);
    fs.writeFileSync(filePath, JSON.stringify(arr, null, 2));
}

module.exports = {
    readJsonFile,
    writeJsonFile,
    flushBufferToFile
}; 