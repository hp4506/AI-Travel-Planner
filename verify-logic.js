const { analyzeBudgetFeasibility, generateItinerary } = require('./services/geminiService');

async function runTest() {
    console.log("--- Testing Feasibility Analyzer (Low Budget) ---");
    try {
        const result = await analyzeBudgetFeasibility(['Paris'], 5000, 5, 'Mumbai, India');
        console.log('Feasibility Result (Low Budget):', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Feasibility Test Failed:', e.message);
    }

    console.log("\n--- Testing Feasibility Analyzer (High Budget) ---");
    let cityBreakdown = [];
    try {
        const result = await analyzeBudgetFeasibility(['Paris'], 200000, 5, 'Mumbai, India');
        console.log('Feasibility Result (High Budget):', JSON.stringify(result, null, 2));
        cityBreakdown = result.cityBreakdown;
    } catch (e) {
        console.error('Feasibility Test Failed:', e.message);
    }

    if (cityBreakdown.length > 0) {
        console.log("\n--- Testing Itinerary Generator ---");
        try {
            const itinerary = await generateItinerary(['Paris'], 200000, 5, 'Mumbai, India', cityBreakdown, { 'Paris': { temp: 15, condition: 'Sunny' } });
            console.log('Itinerary Result:', JSON.stringify(itinerary, null, 2));
        } catch (e) {
            console.error('Itinerary Test Failed:', e.message);
        }
    }
}

runTest();
