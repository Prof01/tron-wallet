const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const passport = require('passport');

// Create a new user
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error creating user', details: err.message });
    }
});

// Update user details
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedUser) return res.status(404).json({ error: 'User not found' });
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: 'Error updating user', details: err.message });
    }
});

// Delete a user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting user', details: err.message });
    }
});

// Login user
router.post('/login', passport.authenticate('local'), (req, res) => {
    res.json({ message: 'Login successful', user: req.user });
});

// Logout user
router.post('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) {
            return next(err);
        }
        res.json({ message: 'Logout successful' });
    });
});

module.exports = router;
