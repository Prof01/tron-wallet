function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ msg: 'Not Allowed, Please Log In' });
}

module.exports = ensureAuthenticated;
// Example usage:
// app.get('/api/protected', ensureAuthenticated, (req, res) => { ... });