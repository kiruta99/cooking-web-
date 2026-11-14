const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { generateMealPlan } = require('../services/mealPlanGenerator');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

// GET all saved meal plans (legacy per-entry table)
router.get('/', requireAuth, (req, res) => {
    db.all('SELECT * FROM meal_plans WHERE user_id = ? ORDER BY plan_date ASC', [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ mealPlans: rows });
    });
});

// GET all saved daily plans with their meals (for Dashboard view)
router.get('/saved-all', requireAuth, (req, res) => {
    const uid = req.session.userId;
    db.all(
        'SELECT * FROM saved_daily_plans WHERE user_id = ? ORDER BY created_at DESC',
        [uid],
        (err, plans) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            if (!plans || plans.length === 0) return res.json({ plans: [] });

            // Fetch meals for every plan in parallel
            let completed = 0;
            const results = [];
            plans.forEach((plan, idx) => {
                db.all(
                    'SELECT * FROM saved_daily_plan_meals WHERE plan_id = ? ORDER BY id ASC',
                    [plan.id],
                    (err2, meals) => {
                        results[idx] = { ...plan, meals: err2 ? [] : (meals || []) };
                        completed++;
                        if (completed === plans.length) {
                            res.json({ plans: results });
                        }
                    }
                );
            });
        }
    );
});

// DELETE a saved daily plan (and cascade-delete its meals via FK)
router.delete('/saved/:id', requireAuth, (req, res) => {
    db.run(
        'DELETE FROM saved_daily_plans WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.userId],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error.' });
            if (this.changes === 0) return res.status(404).json({ error: 'Plan not found.' });
            res.json({ message: 'Meal plan deleted.' });
        }
    );
});

// POST add a single meal plan entry
router.post('/', requireAuth, (req, res) => {
    const { plan_date, meal_type, meal_id, recipe_name } = req.body;
    db.run('INSERT INTO meal_plans (user_id, plan_date, meal_type, meal_id, recipe_name) VALUES (?, ?, ?, ?, ?)',
        [req.session.userId, plan_date, meal_type, meal_id, recipe_name],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.status(201).json({ id: this.lastID, message: 'Meal plan added.' });
        });
});

// DELETE a meal plan entry
router.delete('/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM meal_plans WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'Meal plan deleted.' });
    });
});

// GET the user's latest saved daily plan
router.get('/daily', requireAuth, (req, res) => {
    db.get('SELECT * FROM saved_daily_plans WHERE user_id = ? ORDER BY plan_date DESC LIMIT 1', [req.session.userId], (err, plan) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!plan) return res.json({ plan: null, meals: [] });

        db.all('SELECT * FROM saved_daily_plan_meals WHERE plan_id = ?', [plan.id], (err, meals) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.json({ plan, meals });
        });
    });
});

// POST save a full daily plan
router.post('/save-daily', requireAuth, (req, res) => {
    const { plan_date, total_calories, meals } = req.body;
    if (!plan_date || !meals || !Array.isArray(meals)) {
        return res.status(400).json({ error: 'Invalid plan data.' });
    }

    db.run('INSERT INTO saved_daily_plans (user_id, plan_date, total_calories) VALUES (?, ?, ?)',
        [req.session.userId, plan_date, total_calories],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error.' });
            const planId = this.lastID;

            const stmt = db.prepare('INSERT INTO saved_daily_plan_meals (plan_id, meal_type, meal_id, recipe_name, calories) VALUES (?, ?, ?, ?, ?)');
            for (const meal of meals) {
                stmt.run(planId, meal.meal_type, meal.meal_id || 'local', meal.recipe_name, meal.calories);
            }
            stmt.finalize((err) => {
                if (err) return res.status(500).json({ error: 'Database error while saving meals.' });
                res.status(201).json({ message: 'Daily plan saved successfully!' });
            });
        }
    );
});

// ─── POST /api/meal-plans/generate ──────────────────────────────────────────
// Generates a 1-day meal plan using the heuristic randomised algorithm.
// Optionally uses the logged-in user's saved TDEE if no target is provided.
// Available to both guests (manual target) and authenticated users (auto TDEE).
// ────────────────────────────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
    let { targetCalories, tolerance } = req.body;

    targetCalories = parseInt(targetCalories, 10);
    tolerance = parseInt(tolerance, 10) || 100;

    // Fallback: if the user is logged in and sent no target, pull their saved TDEE
    if ((!targetCalories || isNaN(targetCalories)) && req.session && req.session.userId) {
        const profile = await new Promise((resolve) => {
            db.get(
                'SELECT tdee FROM user_nutrition_profile WHERE user_id = ?',
                [req.session.userId],
                (err, row) => resolve(err ? null : row)
            );
        });
        if (profile && profile.tdee) {
            targetCalories = profile.tdee;
        }
    }

    if (!targetCalories || isNaN(targetCalories) || targetCalories < 1000 || targetCalories > 8000) {
        return res.status(400).json({
            error: 'Please provide a valid calorie target (1,000–8,000 kcal). You can calculate yours with the Calorie Calculator.'
        });
    }

    try {
        const result = generateMealPlan(targetCalories, tolerance);

        res.json({
            targetCalories,
            tolerance,
            totalCalories: result.totalCalories,
            difference: result.totalCalories - targetCalories,
            macros: result.macros,
            plan: result.plan,
            attempts: result.attempts,
            fallback: result.fallback || false,
            note: 'All calorie and macro values are estimates from a local nutritional database. Not medical advice.'
        });
    } catch (err) {
        console.error('Meal plan generation error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
