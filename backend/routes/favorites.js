const express = require('express');
const router = express.Router();
const db = require('../database/db');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Get all favorites
router.get('/', requireAuth, (req, res) => {
    db.all('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error.' });
        }
        res.json({ favorites: rows });
    });
});

// Add favorite
router.post('/', requireAuth, (req, res) => {
    const { meal_id, meal_name, meal_thumb } = req.body;
    if (!meal_id || !meal_name) {
        return res.status(400).json({ error: 'meal_id and meal_name are required.' });
    }

    db.run('INSERT INTO favorites (user_id, meal_id, meal_name, meal_thumb) VALUES (?, ?, ?, ?)',
        [req.session.userId, meal_id, meal_name, meal_thumb],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Already in favorites.' });
                }
                return res.status(500).json({ error: 'Database error.' });
            }
            res.status(201).json({ id: this.lastID, message: 'Added to favorites.' });
        }
    );
});

// Remove favorite
router.delete('/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM favorites WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId], function (err) {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'Removed from favorites.' });
    });
});

// Remove favorite by meal_id
router.delete('/meal/:meal_id', requireAuth, (req, res) => {
    db.run('DELETE FROM favorites WHERE meal_id = ? AND user_id = ?', [req.params.meal_id, req.session.userId], function (err) {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'Removed from favorites.' });
    });
});


module.exports = router;
