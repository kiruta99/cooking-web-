const express = require('express');
const router = express.Router();
const db = require('../database/db');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

// Get reviews for a specific meal
router.get('/:meal_id', (req, res) => {
    db.all('SELECT r.*, u.username FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.meal_id = ? ORDER BY r.created_at DESC', [req.params.meal_id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ reviews: rows });
    });
});

// Post a review
router.post('/:meal_id', requireAuth, (req, res) => {
    const { rating, review_text } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Valid rating (1-5) is required.' });

    db.run('INSERT INTO reviews (user_id, meal_id, rating, review_text) VALUES (?, ?, ?, ?)',
        [req.session.userId, req.params.meal_id, rating, review_text],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.status(201).json({ id: this.lastID, message: 'Review added.' });
        });
});

module.exports = router;
