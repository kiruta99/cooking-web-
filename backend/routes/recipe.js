const express = require('express');
const router = express.Router();
const db = require('../database/db');

// TheMealDB API
const MEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

// GET /api/recipes/:id/nutrition
router.get('/:id/nutrition', async (req, res) => {
    const mealId = req.params.id;

    try {
        // 1. Check Cache
        db.get('SELECT calories FROM recipe_nutrition_cache WHERE meal_id = ?', [mealId], async (err, row) => {
            if (err) {
                console.error('DB error reading cache:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (row) {
                // Cache hit
                return res.json({ kcal: row.calories });
            }

            // 2. Not in cache. Fetch from MealDB to get ingredients
            const mealRes = await fetch(`${MEALDB_BASE_URL}/lookup.php?i=${mealId}`);
            if (!mealRes.ok) {
                return res.status(502).json({ error: 'Failed to fetch from MealDB' });
            }
            const mealData = await mealRes.json();
            
            if (!mealData.meals || mealData.meals.length === 0) {
                return res.status(404).json({ error: 'Recipe not found' });
            }

            const meal = mealData.meals[0];

            // 3. Extract Ingredients
            const ingredients = [];
            for (let i = 1; i <= 20; i++) {
                const ingredient = meal[`strIngredient${i}`];
                const measure = meal[`strMeasure${i}`];
                if (ingredient && ingredient.trim()) {
                    ingredients.push(`${measure ? measure.trim() : ''} ${ingredient.trim()}`.trim());
                }
            }

            // 4. Check for API key
            const apiKey = process.env.NUTRITION_API_KEY;
            if (!apiKey) {
                // No API key - return unavailable
                return res.json({ kcal: null, unavailable: true, reason: 'API key missing' });
            }

            // 5. Fetch Nutrition Data (e.g. from CalorieNinjas)
            const queryText = ingredients.join(', ');
            try {
                const nutritionRes = await fetch(`https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(queryText)}`, {
                    headers: { 'X-Api-Key': apiKey }
                });

                if (!nutritionRes.ok) {
                    console.error('Nutrition API Error:', nutritionRes.status, nutritionRes.statusText);
                    return res.json({ kcal: null, unavailable: true, reason: 'Nutrition API error' });
                }

                const nutritionData = await nutritionRes.json();
                
                // Calculate total calories
                let totalCalories = 0;
                if (nutritionData.items && nutritionData.items.length > 0) {
                    totalCalories = nutritionData.items.reduce((sum, item) => sum + (item.calories || 0), 0);
                }

                // Round to integer
                totalCalories = Math.round(totalCalories);

                // 6. Cache the result
                db.run('INSERT INTO recipe_nutrition_cache (meal_id, calories) VALUES (?, ?)', [mealId, totalCalories], (insertErr) => {
                    if (insertErr) {
                        console.error('Error caching nutrition:', insertErr);
                    }
                });

                return res.json({ kcal: totalCalories });

            } catch (nutErr) {
                console.error('Failed to fetch from Nutrition API:', nutErr);
                return res.json({ kcal: null, unavailable: true, reason: 'Nutrition API request failed' });
            }
        });

    } catch (e) {
        console.error('Error in recipe nutrition route:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
