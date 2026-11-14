const express = require('express');
const router = express.Router();
const db = require('../database/db');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

router.get('/', requireAuth, (req, res) => {
    db.all('SELECT * FROM cooking_history WHERE user_id = ? ORDER BY date_cooked DESC', [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ history: rows });
    });
});

router.post('/', requireAuth, (req, res) => {
    const { meal_id, recipe_name, servings, rating, notes } = req.body;
    db.run('INSERT INTO cooking_history (user_id, meal_id, recipe_name, date_cooked, servings, rating, notes) VALUES (?, ?, ?, DATE("now"), ?, ?, ?)',
        [req.session.userId, meal_id, recipe_name, servings, rating, notes],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.status(201).json({ id: this.lastID, message: 'Cooking history added.' });
        });
});

module.exports = router;
