const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ msg: 'User registered' });
    } catch (err) {
        res.status(400).json({ msg: 'Registration failed', details: err.message });
    }
});

router.post('/login', passport.authenticate('local'), (req, res) => {
    res.json({ msg: 'Logged in successfully' });
});

router.get('/logout', (req, res) => {
    req.logout(() => {
        res.json({ msg: 'Logged out' });
    });
});

module.exports = router;