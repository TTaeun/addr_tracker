const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const addressesFilePath = path.join(__dirname, 'addresses.json');

// Load addresses from file
function loadAddresses() {
    if (fs.existsSync(addressesFilePath)) {
        const data = fs.readFileSync(addressesFilePath);
        return JSON.parse(data);
    }
    return [];
}

// Save addresses to file
function saveAddresses(addresses) {
    fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
}

// API to add a new address
app.post('/add-address', (req, res) => {
    const { category, name, address } = req.body;
    const addresses = loadAddresses();
    addresses.push({ category, name, address });
    saveAddresses(addresses);
    res.status(201).send('Address added');
});

// API to delete an address
app.post('/delete-address', (req, res) => {
    const { address } = req.body;
    let addresses = loadAddresses();
    addresses = addresses.filter(addr => addr.address !== address);
    saveAddresses(addresses);
    res.status(200).send('Address deleted');
});

// API to get the list of addresses
app.get('/addresses', (req, res) => {
    const addresses = loadAddresses();
    res.json(addresses);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 