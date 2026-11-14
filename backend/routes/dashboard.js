const express = require('express');
const router = express.Router();
const db = require('../database/db');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

// GET /api/dashboard/stats — real counts from DB for the logged-in user
router.get('/stats', requireAuth, (req, res) => {
    const uid = req.session.userId;

    const queries = {
        savedRecipes: 'SELECT COUNT(*) AS count FROM favorites WHERE user_id = ?',
        pantryItems:  'SELECT COUNT(*) AS count FROM pantry_items WHERE user_id = ?',
        mealsPlanned: 'SELECT COUNT(*) AS count FROM saved_daily_plans WHERE user_id = ?'
    };

    const results = {};
    let completed = 0;
    const keys = Object.keys(queries);

    keys.forEach(key => {
        db.get(queries[key], [uid], (err, row) => {
            if (err) {
                console.error(`Dashboard stats error for ${key}:`, err);
                results[key] = 0;
            } else {
                results[key] = row ? row.count : 0;
            }
            completed++;
            if (completed === keys.length) {
                res.json(results);
            }
        });
    });
});

module.exports = router;
