const mongoose = require('mongoose');

const TransactionLogSchema = new mongoose.Schema({
    address: String,
    type: String,
    hash: String,
    from: String,
    to: String,
    amount: String,
    tokenContract: String,
    timestamp: Date
});

module.exports = mongoose.model('TransactionLog', TransactionLogSchema);