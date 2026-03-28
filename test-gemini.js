const { analyzeBudgetFeasibility } = require('./services/geminiService');

async function test() {
    try {
        const result = await analyzeBudgetFeasibility(['Paris'], 5000, 5, 'Mumbai, India');
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
