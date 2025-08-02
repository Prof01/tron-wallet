const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ message: 'User registered' });
    } catch (err) {
        res.status(400).json({ error: 'Registration failed', details: err.message });
    }
});

router.post('/login', passport.authenticate('local'), (req, res) => {
    res.json({ message: 'Logged in successfully' });
});

router.get('/logout', (req, res) => {
    req.logout(() => {
        res.json({ message: 'Logged out' });
    });
});

module.exports = router;