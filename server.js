const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const tripRoutes = require('./routes/tripRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
