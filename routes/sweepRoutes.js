const express = require('express');
const router = express.Router();
const SweepLog = require('../models/SweepLog');
const ensureAuthenticated = require('../config/auth');


// Get all Sweep Logs
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const logs = await SweepLog.find();
        res.status(200).json({ logs, msg: 'Success' });
    } catch (err) {
        res.status(500).json({ msg: 'Error fetching logs', details: err.message });
    }
});

// Get SweepLog by ID
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const log = await SweepLog.findById(id);
        if (!log) return res.status(404).json({ msg: 'SweepLog not found' });
        res.status(200).json({ log, msg: 'Success' });
    } catch (err) {
        res.status(500).json({ msg: 'Error fetching Sweep Log', details: err.message });
    }
});

// Delete a user
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedLog = await SweepLog.findByIdAndDelete(id);
        if (!deletedLog) return res.status(404).json({ msg: 'Sweep Log not found' });
        res.json({ msg: 'Sweep Log deleted successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Error deleting Sweep Log', details: err.message });
    }
});

module.exports = router;
