
const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

let pKey = process.env.FIREBASE_PRIVATE_KEY || '';
const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();

console.log('--- [FIREBASE DIAGNOSTIC] ---');
console.log(`Time: ${new Date().toISOString()}`);
console.log(`Project: ${projectId}`);
console.log(`Email: ${clientEmail}`);

if (pKey) {
    pKey = pKey.trim().replace(/^["']|["']$/g, '');
    pKey = pKey.replace(/\\n/g, '\n');
    console.log(`Key length: ${pKey.length}`);
    console.log(`Contains newlines: ${pKey.includes('\n')}`);
    const masked = pKey.substring(0, 25) + '...' + pKey.substring(pKey.length - 25).replace(/\n/g, '\\n');
    console.log(`Key Mask: ${masked}`);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: pKey,
        })
    });
    const db = admin.firestore();
    
    (async () => {
        try {
            console.log('Testing Firestore read...');
            await db.collection('itineraries').limit(1).get();
            console.log('[SUCCESS] Successfully read from Firestore.');
        } catch (err) {
            console.error('--- [FIRESTORE ERROR] ---');
            console.error(`Code: ${err.code}`);
            console.error(`Message: ${err.message}`);
            if(err.code === 16) {
                console.log('Diagnosis: 16 UNAUTHENTICATED. This usually means the system clock is wrong or the private key is malformed.');
            }
        }
        process.exit(0);
    })();
} catch (error) {
    console.error('Fatal initialization error:', error.message);
    process.exit(1);
}
