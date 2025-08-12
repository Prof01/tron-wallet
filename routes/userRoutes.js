const express = require('express');
const User = require('../models/User');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const ensureAuthenticated = require('../config/auth');

// Register a new user
router.post('/register', ensureAuthenticated, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ msg: 'Username and password are required' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ msg: 'Username already exists' });
        }

        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ msg: 'User registered successfully', user: { id: user._id, username: user.username } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Failed to register user' });
    }
});

// Update user details
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedUser) return res.status(404).json({ msg: 'User not found' });
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ msg: 'Error updating user', details: err.message });
    }
});

// Delete a user
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) return res.status(404).json({ msg: 'User not found' });
        res.json({ msg: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Error deleting user', details: err.message });
    }
});

// Login user
router.post('/login', passport.authenticate('user-local'), (req, res) => {
    req.login(req.user, (err) => {
        if (err) {
            console.error('Error during login:', err);
            return res.status(500).json({ msg: 'Login failed', details: err.message });
        }
        res.json({ msg: 'Login successful', user: req.user });
    });
});

// Logout user
router.post('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) {
            return next(err);
        }
        res.json({ msg: 'Logout successful' });
    });
});

// Get all users
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ users, msg: 'Success' });
    } catch (err) {
        res.status(500).json({ msg: 'Error fetching users', details: err.message });
    }
});

// Get user by ID
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.status(200).json({ user, msg: 'Success' });
    } catch (err) {
        res.status(500).json({ msg: 'Error fetching user', details: err.message });
    }
});

// @route GET api/v1/users/user
//@desc Get user Data
//@access Private
router.get('/user', ensureAuthenticated, async(req, res) => {

  User.findById(req.user.id)
  .select('-password -usedSalt')
  .then(user => {
    res.status(200).json({
      user: user,
      msg: 'Success'
    })
  })
  .catch(err => res.status(400).json({
      msg: 'User not found'
  }))
})

module.exports = router;
