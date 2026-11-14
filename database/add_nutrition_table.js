const db = require('../backend/database/db');

const query = `
CREATE TABLE IF NOT EXISTS user_nutrition_profile (
    user_id INTEGER PRIMARY KEY,
    gender TEXT,
    age INTEGER,
    weight REAL,
    height REAL,
    activity_level TEXT,
    bmr INTEGER,
    tdee INTEGER,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
`;

db.run(query, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    } else {
        console.log('user_nutrition_profile table created successfully.');
    }
    db.close();
});
