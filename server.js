const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const tripRoutes = require('./routes/tripRoutes');

dotenv.config();

// ── CRASH PROTECTION ──────────────────────────────────────────────
// Prevent the Node process from dying on unhandled errors.
// This is critical because node --watch restarts the server on crash,
// which kills in-flight HTTP requests and causes "Failed to fetch".
process.on('uncaughtException', (err) => {
    console.error('[CRASH GUARD] Uncaught Exception:', err.message || err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[CRASH GUARD] Unhandled Rejection:', reason?.message || reason);
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

app.get('/test-ping', (req, res) => res.send('Server is alive!'));

app.use('/api/trips', tripRoutes);

app.get('/api/config/firebase', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    });
});

// ── EXPRESS ERROR MIDDLEWARE (must be AFTER all routes) ───────────
// Catches any errors thrown inside async route handlers (Express 5+)
app.use((err, req, res, _next) => {
    console.error('[Express Error]', err.message || err);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error. Please try again.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
