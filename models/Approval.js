const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Wallet'
    },
    type: {
        type: String,
        enum: ['TRX', 'TRC20'],
        required: true
    },
    toAddress: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    tokenContractAddress: String, // Only for TRC20
    approvals: [String], // Passphrases of signers who have approved
    signatures: [String], // Collected signatures
    rawTx: mongoose.Schema.Types.Mixed, // The raw transaction object (can be JSON or string)
    executed: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Approval', ApprovalSchema);