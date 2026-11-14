const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../../database/cookwise.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');

        // Create recipe nutrition cache table
        db.run(`
            CREATE TABLE IF NOT EXISTS recipe_nutrition_cache (
                meal_id TEXT PRIMARY KEY,
                calories INTEGER,
                last_fetched DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
});

module.exports = db;
