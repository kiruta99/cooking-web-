const express = require('express');
const router = express.Router();

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

router.post('/chat', requireAuth, (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required.' });

    // Mock AI response for now
    let reply = "I'm your CookWise AI Chef! I'm currently running in offline mock mode. I can help you with basic cooking questions once I'm fully connected!";
    
    const msgLower = message.toLowerCase();
    if (msgLower.includes('substitute') || msgLower.includes('replace')) {
        reply = "Looking for a substitution? Common substitutes for eggs include applesauce or mashed bananas in baking. For dairy milk, try oat or almond milk!";
    } else if (msgLower.includes('how to cook') || msgLower.includes('how do i cook')) {
        reply = "To cook that properly, ensure your pan is preheated and you have all ingredients prepped (mise en place). Let me know if you need specific times or temperatures!";
    } else if (msgLower.includes('leftover')) {
        reply = "Leftovers are great! You can usually turn almost any leftover meat and veggies into a delicious fried rice or a hearty wrap. Just add some fresh herbs and a sauce.";
    }

    // Add a slight delay to simulate processing
    setTimeout(() => {
        res.json({ reply });
    }, 1000);
});

router.post('/generate-recipe', requireAuth, (req, res) => {
    const { ingredients } = req.body;
    if (!ingredients || ingredients.length === 0) return res.status(400).json({ error: 'Ingredients are required.' });

    // Mock AI Recipe Generation
    const mockRecipe = {
        name: `AI Generated ${ingredients[0]} Surprise`,
        ingredients: ingredients,
        instructions: `1. Chop the ${ingredients.join(', ')}.\n2. Sauté in a pan with some olive oil.\n3. Season with salt, pepper, and your favorite herbs.\n4. Serve hot and enjoy your AI creation!`,
        nutrition: {
            calories: '450 kcal (AI-estimated)',
            protein: '20g',
            carbs: '30g',
            fat: '15g'
        },
        note: "✨ AI Generated Recipe - This is a mock offline recipe."
    };

    setTimeout(() => {
        res.json({ recipe: mockRecipe });
    }, 2000);
});

module.exports = router;
