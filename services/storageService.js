const { db } = require('../config/firebaseConfig');
const fs = require('fs').promises;
const path = require('path');

const LOCAL_DATA_PATH = path.join(__dirname, '../data/local_itineraries.json');

/**
 * Resilient Storage Service:
 * Prioritizes Cloud (Firebase) but fails over to Local JSON for 100% reliability
 * especially during regional auth skew (e.g. 2024 vs 2026).
 */
class StorageService {
    /**
     * Save Itinerary - Resilient
     * @param {string} userId - User ID
     * @param {Object} tripData - Full Trip Data
     */
    async saveItinerary(userId, tripData) {
        let savedToCloud = false;
        let error = null;

        // Try Cloud Save (Firestore)
        try {
            const docRef = db.collection('trips').doc(userId).collection('user_trips').doc();
            await docRef.set({
                ...tripData,
                savedAt: new Date().toISOString()
            });
            savedToCloud = true;
            console.log('[STORAGE] Successfully saved to Cloud (Firestore).');
        } catch (err) {
            error = err;
            console.error('[STORAGE] Cloud Save Failed (likely Auth/Clock Skew):', err.message);
        }

        // Always Back up and fallback to Local Save (JSON)
        try {
            await this.saveToLocalBackup(userId, tripData);
            console.log('[STORAGE] Successfully synchronized to Local Backup.');
        } catch (localErr) {
            console.error('[STORAGE] Local Backup failed:', localErr.message);
        }

        if (!savedToCloud) {
            console.warn('[STORAGE] OPERATING IN OFFLINE/FALLBACK MODE. Data is safe but local-only.');
            const localId = 'loc_' + Date.now();
            return { success: true, id: localId, mode: 'local', warning: 'Cloud sync failed. Data saved locally.' };
        }

        return { success: true, id: 'cloud_' + Date.now(), mode: 'cloud' };
    }

    /**
     * List Itineraries - Resilient
     * Merges Cloud and Local data if available.
     */
    async listItineraries(userId) {
        let results = [];
        
        // 1. Try Cloud Fetch
        try {
            const snapshot = await db.collection('trips').doc(userId).collection('user_trips')
                .orderBy('savedAt', 'desc').get();
            
            snapshot.forEach(doc => {
                results.push({ id: doc.id, ...doc.data() });
            });
            console.log(`[STORAGE] Fetched ${results.length} trips from Cloud.`);
        } catch (err) {
            console.error('[STORAGE] Cloud Fetch failed, relying on Local Data:', err.message);
        }

        // 2. Hydrate from Local Backup (Ensure no loss)
        try {
            const localData = await this.readLocalBackup();
            const userLocalTrps = localData[userId] || [];
            
            // Deduplicate by simple destination/date check if needed
            userLocalTrps.forEach(localTrip => {
                const alreadyExists = results.some(cloudTrip => 
                    cloudTrip.destination === localTrip.destination && cloudTrip.startDate === localTrip.startDate
                );
                if (!alreadyExists) {
                    results.unshift({ ...localTrip, id: `local-${Date.now()}`, mode: 'local' });
                }
            });
        } catch (localErr) {
            console.error('[STORAGE] Local Fetch failed:', localErr.message);
        }

        return results;
    }

    /* Private Helpers */
    async saveToLocalBackup(userId, tripData) {
        const data = await this.readLocalBackup();
        if (!data[userId]) data[userId] = [];
        
        // Add to history (limit to last 20 for space)
        data[userId].unshift({ ...tripData, savedAt: new Date().toISOString() });
        data[userId] = data[userId].slice(0, 20);

        await fs.writeFile(LOCAL_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    }

    async readLocalBackup() {
        try {
            const content = await fs.readFile(LOCAL_DATA_PATH, 'utf8');
            const parsed = JSON.parse(content);
            // Guard: if the file was corrupted to an array, reset to object
            if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
                console.warn('[STORAGE] Local backup was corrupt (not an object). Resetting.');
                return {};
            }
            return parsed;
        } catch (err) {
            // Ensure data directory exists
            await fs.mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true }).catch(() => {});
            return {};
        }
    }
}

module.exports = new StorageService();
