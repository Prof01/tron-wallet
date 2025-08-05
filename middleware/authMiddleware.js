const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ msg: 'Unauthorized. Please log in.' });
};

module.exports = ensureAuthenticated;