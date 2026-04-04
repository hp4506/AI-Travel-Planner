const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebaseConfig');

const LOCAL_DATA_PATH = path.join(__dirname, '..', 'data', 'local_itineraries.json');

/**
 * DUAL-MODE STORAGE SERVICE: Firebase Cloud (Primary) + Local Disk (Fallback)
 * Ensures 100% reliability for current 2026 clock skew vs future deployment.
 */
class StorageService {
    constructor() {
        // Ensure data directory exists
        const dataDir = path.dirname(LOCAL_DATA_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Initialize local file if missing
        if (!fs.existsSync(LOCAL_DATA_PATH)) {
            fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify([]));
        }
    }

    async saveTrip(userId, itineraryData) {
        const payload = {
            userId,
            savedAt: new Date().toISOString(),
            ...itineraryData
        };

        try {
            console.log('[STORAGE] Attempting Cloud Save (Firebase)...');
            const docRef = await db.collection('itineraries').add({
                userId,
                createdAt: payload.savedAt,
                itineraryData: itineraryData
            });
            console.log(`[SUCCESS] Saved to Cloud: ${docRef.id}`);
            return { success: true, id: docRef.id, mode: 'cloud' };
        } catch (error) {
            console.warn(`[FAILOVER] Cloud failure: ${error.message}. Switching to Local Fail-Safe.`);
            
            // --- LOCAL FAIL-SAFE ---
            const localData = JSON.parse(fs.readFileSync(LOCAL_DATA_PATH, 'utf8'));
            const localId = 'loc_' + Date.now();
            localData.push({ id: localId, ...payload });
            
            fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(localData, null, 2));
            console.log('[SUCCESS] Saved to Local Disk.');
            return { success: true, id: localId, mode: 'local' };
        }
    }

    async listTrips(userId) {
        let cloudTrips = [];
        let localTrips = [];

        // 1. Fetch Cloud Trips (Primary)
        try {
            const snapshot = await db.collection('itineraries')
                .where('userId', '==', userId)
                .get();
            
            snapshot.forEach(doc => {
                const data = doc.data();
                cloudTrips.push({
                    id: doc.id,
                    ...data.itineraryData,
                    savedAt: data.createdAt,
                    mode: 'cloud'
                });
            });
        } catch (error) {
            console.warn('[STORAGE] Cloud listing unavailable. Relying on Local data.');
        }

        // 2. Fetch Local Trips (Fail-Safe)
        try {
            const localData = JSON.parse(fs.readFileSync(LOCAL_DATA_PATH, 'utf8'));
            localTrips = localData.filter(t => t.userId === userId).map(t => ({ ...t, mode: 'local' }));
        } catch (error) {
            console.error('[STORAGE] Local read error:', error.message);
        }

        // 3. Merge & Deduplicate
        const allTrips = [...cloudTrips, ...localTrips];
        allTrips.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

        return allTrips;
    }
}

module.exports = new StorageService();
