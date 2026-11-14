const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true,          // reflect the request origin (works for same-host)
    credentials: true      // allow session cookies to be sent
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'cookwise_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pantry', require('./routes/pantry'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/meal-plans', require('./routes/mealPlans'));
app.use('/api/shopping-list', require('./routes/shoppingList'));
app.use('/api/history', require('./routes/history'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/nutrition', require('./routes/nutrition'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/recipes', require('./routes/recipe'));
// Fallback route to serve index.html for unknown routes (if using frontend routing)
// Since we are using multiple HTML files, we can just redirect to index.html for 404s
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
