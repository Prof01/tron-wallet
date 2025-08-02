const mongoose = require('mongoose');

const SingleWalletSchema = new mongoose.Schema({
    address: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true },
    mnemonic: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SingleWallet', SingleWalletSchema);
