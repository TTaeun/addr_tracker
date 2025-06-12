const { v4: uuidv4 } = require('uuid');

const trIdMap = {}; // key: `${name}::${address}::${coin}`, value: trId

function getOrCreateTrId(key, type) {
    if (type === 'NEW' || !trIdMap[key]) {
        trIdMap[key] = uuidv4();
    }
    return trIdMap[key];
}

function deleteTrId(key) {
    delete trIdMap[key];
}

module.exports = {
    getOrCreateTrId,
    deleteTrId
}; 