const express = require('express');
const router = express.Router();
const db = require('../database/db');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

// Simplified shopping list (no multi-list management for now, just a single list for user)
router.get('/', requireAuth, (req, res) => {
    db.get('SELECT id FROM shopping_lists WHERE user_id = ?', [req.session.userId], (err, list) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!list) return res.json({ items: [] });
        
        db.all('SELECT * FROM shopping_list_items WHERE list_id = ?', [list.id], (err, items) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.json({ items });
        });
    });
});

router.post('/', requireAuth, (req, res) => {
    const { ingredient_name, quantity, unit } = req.body;
    
    // Ensure list exists
    db.get('SELECT id FROM shopping_lists WHERE user_id = ?', [req.session.userId], (err, list) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        
        let listId;
        const addItem = (id) => {
            db.run('INSERT INTO shopping_list_items (list_id, ingredient_name, quantity, unit) VALUES (?, ?, ?, ?)',
                [id, ingredient_name, quantity, unit], function (err) {
                    if (err) return res.status(500).json({ error: 'Database error.' });
                    res.status(201).json({ id: this.lastID, message: 'Item added.' });
            });
        };

        if (!list) {
            db.run('INSERT INTO shopping_lists (user_id) VALUES (?)', [req.session.userId], function (err) {
                if (err) return res.status(500).json({ error: 'Database error.' });
                addItem(this.lastID);
            });
        } else {
            addItem(list.id);
        }
    });
});

router.put('/:id', requireAuth, (req, res) => {
    const { is_checked } = req.body;
    db.run('UPDATE shopping_list_items SET is_checked = ? WHERE id = ?', [is_checked ? 1 : 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'Item updated.' });
    });
});

router.delete('/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM shopping_list_items WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'Item deleted.' });
    });
});

module.exports = router;
