const storageService = require('./services/storageService');

async function testFinalStorage() {
    console.log('--- TESTING RESILIENT DUAL-MODE STORAGE ---');
    
    const mockData = {
        totalEstimatedCost: 5000,
        itinerary: [{ day: 1, city: 'Dubai', blocks: {} }]
    };

    try {
        console.log('\n[SAVE TEST]');
        const saveResult = await storageService.saveTrip('test-user-123', mockData);
        console.log(`Save result: ${JSON.stringify(saveResult)}`);

        if (saveResult.mode === 'local' || saveResult.mode === 'cloud') {
            console.log('[SUCCESS] Save handled correctly.');
        }

        console.log('\n[LIST TEST]');
        const trips = await storageService.listTrips('test-user-123');
        console.log(`Managed to fetch ${trips.length} trips.`);
        
        if (trips.length > 0) {
            console.log('[SUCCESS] List feature is operational.');
        }

    } catch (err) {
        console.error('[FAILURE] Final storage test failed:', err);
    }
}

testFinalStorage();
