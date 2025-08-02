const mongoose = require('mongoose');

const SweepLogSchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    amount: { type: String, required: true }, // Store as string for precision
    txid: { type: String },
    status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
    error: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SweepLog', SweepLogSchema);
