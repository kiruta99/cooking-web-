const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db');

// Register
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    
    if (password.length < 5 || password.length > 20) {
        return res.status(400).json({ error: 'Password must be between 5 and 20 characters.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Username or email already exists.' });
                    }
                    console.error(err);
                    return res.status(500).json({ error: 'Database error during registration.' });
                }
                
                const userId = this.lastID;
                // Create empty profile
                db.run('INSERT INTO profiles (user_id, name) VALUES (?, ?)', [userId, username]);

                req.session.userId = userId;
                req.session.username = username;
                res.status(201).json({ message: 'Registration successful!', user: { id: userId, username } });
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    
    if (password.length < 5 || password.length > 20) {
        return res.status(400).json({ error: 'Password must be between 5 and 20 characters.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error.' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ message: 'Login successful!', user: { id: user.id, username: user.username } });
    });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out.' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully.' });
    });
});

// Get current user (Me)
router.get('/me', (req, res) => {
    if (req.session.userId) {
        db.get('SELECT u.id, u.username, u.email, p.name, p.bio, p.favorite_cuisines, p.dietary_preferences, p.cooking_skill FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?', 
        [req.session.userId], (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            res.json({ user });
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});
// Change Password
router.post('/change-password', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    if (newPassword.length < 5 || newPassword.length > 20) {
        return res.status(400).json({ error: 'Password must be between 5 and 20 characters.' });
    }

    db.get('SELECT password_hash FROM users WHERE id = ?', [req.session.userId], async (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Database error or user not found.' });
        }

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNewPassword, req.session.userId], (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ error: 'Could not update password.' });
            }
            res.json({ message: 'Password changed successfully.' });
        });
    });
});

module.exports = router;
