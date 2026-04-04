const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
try {
    if (!admin.apps.length) {
        const path = require('path');
        const fs = require('fs');
        const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
        
        // --- CLOCK GUARD ---
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        if (currentYear > 2025) {
            console.log('\n' + '-'.repeat(60));
            console.log(` [NOTICE] Cloud Storage (Firebase) may be unavailable.`);
            console.log(` Reason: System clock is in the future (${currentDate.toISOString()}).`);
            console.log(` Action: Using Resilient Local Storage Fail-over.`);
            console.log('-'.repeat(60) + '\n');
        }

        let credential;
        if (fs.existsSync(serviceAccountPath)) {
            console.log('[FIREBASE] Loading credentials from service-account.json');
            const serviceAccount = require(serviceAccountPath);
            credential = admin.credential.cert(serviceAccount);
        } else {
            console.log('[FIREBASE] service-account.json not found, falling back to environment variables');
            let pKey = process.env.FIREBASE_PRIVATE_KEY || '';
            const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();

            if (pKey) {
                pKey = pKey.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
            }

            if (!projectId || !clientEmail || !pKey) {
                throw new Error('Firebase Admin credentials incomplete! Check your .env file or service-account.json.');
            }

            credential = admin.credential.cert({
                projectId: projectId,
                clientEmail: clientEmail,
                privateKey: pKey,
            });
        }

        admin.initializeApp({ credential });
        console.log(`[SUCCESS] Firebase Admin initialized for project: ${process.env.FIREBASE_PROJECT_ID || 'ServiceAccount'}`);
    }
} catch (error) {
    console.error('--- FATAL: Firebase Initialization Error ---');
    console.error(error.message || error);
}

const db = admin.firestore();

module.exports = { db };
