const express = require('express');
const router = express.Router();
const db = require('../database/db');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

// GET /api/nutrition/profile — retrieve saved calorie profile
router.get('/profile', requireAuth, (req, res) => {
    db.get(
        'SELECT * FROM user_nutrition_profile WHERE user_id = ?',
        [req.session.userId],
        (err, row) => {
            if (err) {
                console.error('DB error fetching nutrition profile:', err);
                return res.status(500).json({ error: 'Database error.' });
            }
            res.json({ profile: row || null });
        }
    );
});

// POST /api/nutrition/profile — save or update calorie profile
router.post('/profile', requireAuth, (req, res) => {
    const { gender, age, weight, height, activity_level, bmr, tdee } = req.body;

    // Validate server-side too
    if (!gender || !age || !weight || !height || !activity_level || !bmr || !tdee) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    if (age <= 0 || weight <= 0 || height <= 0) {
        return res.status(400).json({ error: 'Age, weight, and height must be positive numbers.' });
    }
    if (!['male', 'female'].includes(gender)) {
        return res.status(400).json({ error: 'Invalid gender.' });
    }

    const sql = `
        INSERT INTO user_nutrition_profile
            (user_id, gender, age, weight, height, activity_level, bmr, tdee, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            gender       = excluded.gender,
            age          = excluded.age,
            weight       = excluded.weight,
            height       = excluded.height,
            activity_level = excluded.activity_level,
            bmr          = excluded.bmr,
            tdee         = excluded.tdee,
            calculated_at = CURRENT_TIMESTAMP
    `;

    db.run(sql, [req.session.userId, gender, age, weight, height, activity_level, bmr, tdee], function (err) {
        if (err) {
            console.error('DB error saving nutrition profile:', err);
            return res.status(500).json({ error: 'Database error.' });
        }
        res.json({ message: 'Calorie profile saved successfully.' });
    });
});

module.exports = router;
