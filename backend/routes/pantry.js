const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Get all pantry items for user
router.get('/', requireAuth, (req, res) => {
    db.all('SELECT * FROM pantry_items WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error.' });
        }
        res.json({ items: rows });
    });
});

// Add new pantry item
router.post('/', requireAuth, (req, res) => {
    const { ingredient_name, quantity, unit, expiration_date, category } = req.body;
    if (!ingredient_name) {
        return res.status(400).json({ error: 'Ingredient name is required.' });
    }

    db.run('INSERT INTO pantry_items (user_id, ingredient_name, quantity, unit, expiration_date, category) VALUES (?, ?, ?, ?, ?, ?)',
        [req.session.userId, ingredient_name, quantity, unit, expiration_date, category],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error.' });
            }
            res.status(201).json({ id: this.lastID, message: 'Item added.' });
        }
    );
});

// Update pantry item
router.put('/:id', requireAuth, (req, res) => {
    const { ingredient_name, quantity, unit, expiration_date, category } = req.body;
    db.run('UPDATE pantry_items SET ingredient_name = ?, quantity = ?, unit = ?, expiration_date = ?, category = ? WHERE id = ? AND user_id = ?',
        [ingredient_name, quantity, unit, expiration_date, category, req.params.id, req.session.userId],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error.' });
            }
            res.json({ message: 'Item updated.' });
        }
    );
});

// Delete pantry item
router.delete('/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM pantry_items WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error.' });
        }
        res.json({ message: 'Item deleted.' });
    });
});

module.exports = router;
