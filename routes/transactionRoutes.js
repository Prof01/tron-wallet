const express = require('express');
const router = express.Router();
const TransactionLog = require('../models/TransactionLog');


// Get all Transaction Logs
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const logs = await TransactionLog.find();
        res.status(200).json({ logs, msg: 'Success' });
    } catch (err) {
        res.status(500).json({ msg: 'Error fetching logs', details: err.message });
    }
});

// Get TransactionLog by ID
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const log = await TransactionLog.findById(id);
        if (!log) return res.status(404).json({ msg: 'TransactionLog not found' });
        res.status(200).json({ log, msg: 'Success' });
    } catch (err) {
        res.status(500).json({ msg: 'Error fetching Transaction Log', details: err.message });
    }
});

// Delete a user
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedLog = await TransactionLog.findByIdAndDelete(id);
        if (!deletedLog) return res.status(404).json({ msg: 'Transaction Log not found' });
        res.json({ msg: 'Transaction Log deleted successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Error deleting Transaction Log', details: err.message });
    }
});

module.exports = router;
