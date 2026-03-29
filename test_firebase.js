const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
    
    const db = admin.firestore();
    db.collection('itineraries').limit(1).get()
      .then(snap => {
          console.log('SUCCESS: Read', snap.docs.length, 'docs');
      })
      .catch(err => {
          console.error('FIREBASE AUTH ERROR:', err.message);
      });

} catch(e) {
    console.error('INIT ERROR:', e.message);
}
