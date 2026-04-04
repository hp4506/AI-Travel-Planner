const admin = require('firebase-admin');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

/**
 * DEEP DIAGNOSTIC FOR FIREBASE AUTHENTICATION
 * This script identifies why Firestore saves are failing (16 UNAUTHENTICATED).
 */
async function runDeepDiagnostic() {
    console.log('\n=== [ VAGAWISE DEEP DIAGNOSTIC ] ===');
    const localTime = new Date();
    console.log(`1. Local System Time: ${localTime.toISOString()}`);
    console.log(`   Year Detected: ${localTime.getFullYear()}`);

    // --- TEST 1: Check External Time ---
    try {
        console.log('2. Fetching World Time (Google API)...');
        const worldTimeRes = await axios.get('https://www.google.com', { timeout: 5000 });
        const worldTimeStr = worldTimeRes.headers.date;
        const worldTime = new Date(worldTimeStr);
        console.log(`   World Time: ${worldTime.toISOString()}`);
        
        const diffMs = Math.abs(localTime - worldTime);
        const diffMins = Math.round(diffMs / 60000);
        
        if (diffMins > 5) {
            console.error(`   [CRITICAL] Clock Skew Detected! Your clock is off by ${diffMins} minutes.`);
            console.error('   Google Cloud WILL REJECT your connection if the clock is off by more than 5 minutes.');
            if (localTime.getFullYear() > 2025) {
                console.error('   Your clock is set to 2026. THIS IS THE ROOT CAUSE.');
            }
        } else {
            console.log('   [SUCCESS] Clock is synchronized within acceptable limits.');
        }
    } catch (err) {
        console.warn('   [WARN] Could not fetch world time. Skipping skew check.');
    }

    // --- TEST 2: Check Credentials ---
    console.log('3. Checking Credentials...');
    let serviceAccount;
    const saPath = path.join(__dirname, 'service-account.json');
    
    if (fs.existsSync(saPath)) {
        console.log('   Found service-account.json');
        serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    } else {
        console.log('   Using .env variables...');
        let pKey = process.env.FIREBASE_PRIVATE_KEY || '';
        if (pKey) pKey = pKey.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: pKey
        };
    }

    console.log(`   Project ID: ${serviceAccount.projectId || serviceAccount.project_id}`);
    console.log(`   Client Email: ${serviceAccount.client_email || serviceAccount.clientEmail}`);

    // --- TEST 3: Initialize & Attempt Write ---
    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        const db = admin.firestore();
        console.log('4. Attempting Firestore Write to "diagnostic_test" collection...');
        
        const docRef = await db.collection('diagnostic_test').add({
            test: 'Deep Diagnostic Run',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            platform: 'Node.js Admin SDK'
        });

        console.log(`   [SUCCESS] Successfully wrote document: ${docRef.id}`);
        console.log('   RESULT: Your Firebase setup is WORKING PERFECTLY.');
    } catch (error) {
        console.error('\n--- [ DIAGNOSTIC ERROR REPORT ] ---');
        console.error(`Error Code: ${error.code}`);
        console.error(`Message: ${error.message}`);
        
        if (error.message.includes('UNAUTHENTICATED') || error.code === 16) {
            console.log('\nDIAGNOSIS: Authentication Failure.');
            console.log('1. FIX: Check your system date/year. Google sees 2026 as invalid.');
            console.log('2. FIX: Ensure the Service Account has "Firebase Admin" role in IAM console.');
            console.log('3. FIX: Generate a NEW private key from Firebase Console settings.');
        } else if (error.message.includes('PERMISSION_DENIED')) {
            console.log('\nDIAGNOSIS: Permission Denied.');
            console.log('FIX: Enable Firestore in the Firebase Console (Production/Test mode).');
        } else {
            console.log('\nDIAGNOSIS: Unknown connectivity issue. Check your firewall/VPN.');
        }
    }
    
    process.exit(0);
}

runDeepDiagnostic();
