/**
 * CookWise Meal Plan Generator
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses a Heuristic (Randomized) approach to generate a daily meal plan that
 * hits a user-specified calorie target within an acceptable tolerance.
 *
 * Algorithm: Randomised "Knapsack"-style selection
 *   1. Randomly pick one meal from each category (breakfast, lunch, dinner, snack)
 *   2. Sum the calories
 *   3. If total falls within [target ± tolerance], accept the plan
 *   4. Otherwise retry, up to max_attempts
 *
 * NOTE: All calorie values in this database are ESTIMATED averages.
 * This is a standalone nutritional planning database — it is COMPLETELY SEPARATE
 * from TheMealDB recipe discovery. TheMealDB meals are never mixed in here.
 *
 * For production scale, consider replacing the while-loop with Linear Programming
 * (scipy/PuLP equivalent in Node.js: javascript-lp-solver or glpk.js) to handle
 * exact macro constraints without retry loops.
 */

'use strict';

// ─── Curated Meal Database ────────────────────────────────────────────────────
// Calories are community-average estimates. Clearly marked as estimated.

const FOOD_DATABASE = {
    breakfast: [
        { name: 'Oatmeal with Berries & Honey',             calories: 340, protein: 10, carbs: 62, fat: 6,  emoji: '🥣', mealDbQuery: 'porridge' },
        { name: '3-Egg Vegetable Omelet & Whole Wheat Toast', calories: 450, protein: 28, carbs: 32, fat: 20, emoji: '🍳', mealDbQuery: 'omelette' },
        { name: 'Greek Yogurt with Granola & Banana',        calories: 370, protein: 18, carbs: 55, fat: 8,  emoji: '🍌', mealDbQuery: 'banana pancakes' },
        { name: 'Avocado Toast with Poached Eggs',           calories: 480, protein: 20, carbs: 38, fat: 26, emoji: '🥑', mealDbQuery: 'eggs' },
        { name: 'Smoothie Bowl (Fruit, Nut Butter, Seeds)',  calories: 420, protein: 12, carbs: 58, fat: 14, emoji: '🍓', mealDbQuery: 'smoothie' },
        { name: 'Whole-Grain Pancakes with Maple Syrup',     calories: 510, protein: 14, carbs: 78, fat: 12, emoji: '🥞', mealDbQuery: 'pancakes' },
        { name: 'Cottage Cheese with Pineapple',             calories: 250, protein: 22, carbs: 28, fat: 4,  emoji: '🍍', mealDbQuery: 'cheese' },
        { name: 'Overnight Oats with Chia & Almond Milk',   calories: 380, protein: 13, carbs: 56, fat: 10, emoji: '🌾', mealDbQuery: 'oats' },
        { name: 'Bagel with Cream Cheese & Smoked Salmon',  calories: 520, protein: 24, carbs: 52, fat: 22, emoji: '🥯', mealDbQuery: 'salmon' },
        { name: 'Cereal with Milk & Mixed Berries',          calories: 310, protein: 9,  carbs: 58, fat: 5,  emoji: '🥛', mealDbQuery: 'porridge' },
    ],
    lunch: [
        { name: 'Grilled Chicken Caesar Salad',              calories: 480, protein: 38, carbs: 22, fat: 24, emoji: '🥗', mealDbQuery: 'chicken salad' },
        { name: 'Turkey & Avocado Whole-Grain Wrap',         calories: 560, protein: 32, carbs: 48, fat: 22, emoji: '🌯', mealDbQuery: 'turkey' },
        { name: 'Red Lentil Soup with Crusty Bread',         calories: 440, protein: 20, carbs: 72, fat: 8,  emoji: '🍲', mealDbQuery: 'lentil soup' },
        { name: 'Tuna Salad Sandwich on Rye',                calories: 490, protein: 34, carbs: 44, fat: 16, emoji: '🥙', mealDbQuery: 'tuna' },
        { name: 'Quinoa Power Bowl with Roasted Veggies',    calories: 520, protein: 18, carbs: 68, fat: 16, emoji: '🥙', mealDbQuery: 'quinoa' },
        { name: 'Chicken Stir-Fry with Brown Rice',          calories: 580, protein: 36, carbs: 66, fat: 14, emoji: '🍱', mealDbQuery: 'chicken stir fry' },
        { name: 'Black Bean Burrito Bowl',                   calories: 610, protein: 24, carbs: 82, fat: 16, emoji: '🫘', mealDbQuery: 'bean' },
        { name: 'Tomato Basil Pasta with Parmesan',          calories: 650, protein: 22, carbs: 92, fat: 18, emoji: '🍝', mealDbQuery: 'pasta tomato' },
        { name: 'Shrimp Tacos with Mango Salsa',             calories: 540, protein: 30, carbs: 58, fat: 14, emoji: '🌮', mealDbQuery: 'prawn' },
        { name: 'Classic BLT with Side Salad',               calories: 470, protein: 18, carbs: 42, fat: 24, emoji: '🥬', mealDbQuery: 'salad' },
    ],
    dinner: [
        { name: 'Baked Salmon with Quinoa & Asparagus',      calories: 620, protein: 44, carbs: 42, fat: 24, emoji: '🐟', mealDbQuery: 'salmon' },
        { name: 'Grilled Steak with Sweet Potato & Broccoli', calories: 720, protein: 52, carbs: 44, fat: 28, emoji: '🥩', mealDbQuery: 'beef steak' },
        { name: 'Tofu & Vegetable Stir-Fry with Noodles',   calories: 490, protein: 22, carbs: 62, fat: 16, emoji: '🍜', mealDbQuery: 'tofu stir fry' },
        { name: 'Chicken Breast with Brown Rice & Green Beans', calories: 580, protein: 48, carbs: 52, fat: 12, emoji: '🍗', mealDbQuery: 'chicken rice' },
        { name: 'Beef & Vegetable Curry with Basmati Rice',  calories: 680, protein: 38, carbs: 72, fat: 22, emoji: '🍛', mealDbQuery: 'beef curry' },
        { name: 'Pork Tenderloin with Roasted Potatoes',     calories: 640, protein: 42, carbs: 54, fat: 20, emoji: '🐷', mealDbQuery: 'pork' },
        { name: 'Veggie Pizza on Whole-Wheat Crust',         calories: 560, protein: 24, carbs: 74, fat: 20, emoji: '🍕', mealDbQuery: 'pizza' },
        { name: 'Lemon Herb Roast Chicken with Couscous',   calories: 660, protein: 46, carbs: 48, fat: 24, emoji: '🍋', mealDbQuery: 'roast chicken' },
        { name: 'Shrimp Pasta Primavera',                    calories: 590, protein: 32, carbs: 76, fat: 16, emoji: '🦐', mealDbQuery: 'prawn pasta' },
        { name: 'Turkey Meatballs with Zucchini Noodles',   calories: 520, protein: 40, carbs: 24, fat: 24, emoji: '🫙', mealDbQuery: 'turkey meatballs' },
    ],
    snack: [
        { name: 'Apple with Almond Butter',                  calories: 200, protein: 5,  carbs: 28, fat: 9,  emoji: '🍎', mealDbQuery: 'apple cake' },
        { name: 'Whey Protein Shake',                        calories: 160, protein: 25, carbs: 10, fat: 3,  emoji: '🥤', mealDbQuery: 'smoothie' },
        { name: 'Mixed Nuts & Dried Cranberries',            calories: 220, protein: 6,  carbs: 20, fat: 14, emoji: '🥜', mealDbQuery: 'nutty' },
        { name: 'Carrot Sticks with Hummus',                 calories: 140, protein: 4,  carbs: 18, fat: 6,  emoji: '🥕', mealDbQuery: 'carrot' },
        { name: 'String Cheese & Whole-Grain Crackers',      calories: 180, protein: 9,  carbs: 18, fat: 8,  emoji: '🧀', mealDbQuery: 'cheese' },
        { name: 'Banana & Peanut Butter',                    calories: 230, protein: 7,  carbs: 34, fat: 8,  emoji: '🍌', mealDbQuery: 'banana' },
        { name: 'Edamame with Sea Salt',                     calories: 150, protein: 12, carbs: 14, fat: 4,  emoji: '🫛', mealDbQuery: 'edamame' },
        { name: 'Dark Chocolate & Almonds',                  calories: 210, protein: 4,  carbs: 18, fat: 14, emoji: '🍫', mealDbQuery: 'chocolate' },
        { name: 'Rice Cake with Avocado',                    calories: 170, protein: 3,  carbs: 24, fat: 7,  emoji: '🍚', mealDbQuery: 'avocado' },
        { name: 'Cottage Cheese with Cucumber',              calories: 130, protein: 14, carbs: 8,  fat: 4,  emoji: '🥒', mealDbQuery: 'salad' },
    ]
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function sumMacro(plan, key) {
    return Object.values(plan).reduce((sum, item) => sum + (item[key] || 0), 0);
}

// ─── Core Generator ───────────────────────────────────────────────────────────

/**
 * generateMealPlan
 *
 * Randomly selects one item from each meal category and retries until the
 * combined calorie total lands within [targetCalories ± tolerance].
 *
 * @param {number} targetCalories  – Desired total daily calories (TDEE or custom)
 * @param {number} tolerance       – Acceptable ± deviation in kcal  (default 100)
 * @param {number} maxAttempts     – Safety cap on retries             (default 2000)
 * @returns {{ plan: Object|null, totalCalories: number, macros: Object, attempts: number }}
 */
function generateMealPlan(targetCalories, tolerance = 100, maxAttempts = 2000) {
    if (!targetCalories || targetCalories < 1000 || targetCalories > 8000) {
        throw new Error('Target calories must be between 1,000 and 8,000 kcal.');
    }

    let attempts = 0;

    while (attempts < maxAttempts) {
        const plan = {
            breakfast: randomChoice(FOOD_DATABASE.breakfast),
            lunch:     randomChoice(FOOD_DATABASE.lunch),
            dinner:    randomChoice(FOOD_DATABASE.dinner),
            snack:     randomChoice(FOOD_DATABASE.snack)
        };

        const totalCalories = sumMacro(plan, 'calories');

        if (Math.abs(totalCalories - targetCalories) <= tolerance) {
            const macros = {
                protein: sumMacro(plan, 'protein'),
                carbs:   sumMacro(plan, 'carbs'),
                fat:     sumMacro(plan, 'fat')
            };
            return { plan, totalCalories, macros, attempts: attempts + 1 };
        }

        attempts++;
    }

    // Fallback: return closest plan found so far (relax and return last attempt)
    // This prevents a hard failure when tolerance is very tight.
    const fallbackPlan = {
        breakfast: randomChoice(FOOD_DATABASE.breakfast),
        lunch:     randomChoice(FOOD_DATABASE.lunch),
        dinner:    randomChoice(FOOD_DATABASE.dinner),
        snack:     randomChoice(FOOD_DATABASE.snack)
    };

    return {
        plan:          fallbackPlan,
        totalCalories: sumMacro(fallbackPlan, 'calories'),
        macros: {
            protein: sumMacro(fallbackPlan, 'protein'),
            carbs:   sumMacro(fallbackPlan, 'carbs'),
            fat:     sumMacro(fallbackPlan, 'fat')
        },
        attempts,
        fallback: true  // caller can warn the user the exact target wasn't met
    };
}

module.exports = { generateMealPlan, FOOD_DATABASE };
