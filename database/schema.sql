-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY,
    name TEXT,
    bio TEXT,
    favorite_cuisines TEXT, -- JSON string or comma separated
    dietary_preferences TEXT,
    cooking_skill TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Favorites Table (Stores TheMealDB IDs)
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    meal_id TEXT NOT NULL, -- TheMealDB ID is often numeric string, but better store as TEXT to be safe
    meal_name TEXT NOT NULL,
    meal_thumb TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, meal_id)
);

-- Kitchen / Pantry
CREATE TABLE IF NOT EXISTS pantry_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ingredient_name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    expiration_date DATE,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Meal Plans
CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_date DATE NOT NULL,
    meal_type TEXT NOT NULL, -- 'Breakfast', 'Lunch', 'Dinner', 'Snack'
    meal_id TEXT NOT NULL, -- TheMealDB ID
    recipe_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Shopping Lists
CREATE TABLE IF NOT EXISTS shopping_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Saved Daily Plans
CREATE TABLE IF NOT EXISTS saved_daily_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_date DATE NOT NULL,
    total_calories INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Saved Daily Plan Meals
CREATE TABLE IF NOT EXISTS saved_daily_plan_meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    meal_type TEXT NOT NULL,
    meal_id TEXT NOT NULL,
    recipe_name TEXT NOT NULL,
    calories INTEGER,
    FOREIGN KEY (plan_id) REFERENCES saved_daily_plans (id) ON DELETE CASCADE
);

-- Shopping List Items
CREATE TABLE IF NOT EXISTS shopping_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    ingredient_name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    is_checked BOOLEAN DEFAULT 0,
    FOREIGN KEY (list_id) REFERENCES shopping_lists (id) ON DELETE CASCADE
);

-- Cooking History
CREATE TABLE IF NOT EXISTS cooking_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    meal_id TEXT NOT NULL,
    recipe_name TEXT NOT NULL,
    date_cooked DATE NOT NULL,
    servings INTEGER DEFAULT 1,
    rating REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- CookWise Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    meal_id TEXT NOT NULL,
    rating REAL NOT NULL CHECK(rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- AI Messages
CREATE TABLE IF NOT EXISTS ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'user' or 'ai'
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id) ON DELETE CASCADE
);

-- User Nutrition Profile
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
