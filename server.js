require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory admin session (for demo purposes)
// In production, use proper session management
const adminSessions = new Set();

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !adminSessions.has(authHeader)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === process.env.ADMIN_PASSWORD) {
        // Generate a simple session token
        const token = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        adminSessions.add(token);
        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Admin logout
app.post('/api/admin/logout', requireAdmin, (req, res) => {
    const authHeader = req.headers.authorization;
    adminSessions.delete(authHeader);
    res.json({ success: true });
});

// Get Supabase config for frontend
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Retro-Geo server running on http://localhost:${PORT}`);
});
