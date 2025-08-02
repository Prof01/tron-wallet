const mongoose = require('mongoose');

const SignerSchema = new mongoose.Schema({
    address: { type: String, required: true },
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true },
    passphrase: { type: String, required: true }
}, { _id: false });

const WalletSchema = new mongoose.Schema({
    address: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true },
    mnemonic: { type: String, required: true },
    signerOne: { type: SignerSchema, required: true },
    signerTwo: { type: SignerSchema, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Wallet', WalletSchema);