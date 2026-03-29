const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
try {
    if (!admin.apps.length) {
        let pKey = process.env.FIREBASE_PRIVATE_KEY || '';
        pKey = pKey.replace(/\\n/g, '\n').replace(/"/g, '').trim();
        
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
                privateKey: pKey,
            })
        });
        console.log('Firebase Admin initialized successfully.');
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
}

const db = admin.firestore();

module.exports = { db };
