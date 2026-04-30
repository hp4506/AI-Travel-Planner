const COST_INDEX_MAP = {
    'paris': 2.5, 'london': 2.5, 'tokyo': 2.5, 'nyc': 2.8, 'new york': 2.8, 'zurich': 3.0, 'geneva': 3.0,
    'singapore': 2.2, 'dubai': 2.0, 'hong kong': 2.2, 'venice': 2.3, 'rome': 1.8, 'milan': 1.9, 'sthlm': 2.1,
    'mumbai': 1.2, 'delhi': 1.2, 'bangalore': 1.1, 'hyderabad': 1.0, 'goa': 1.1, 'pune': 1.0,
    'istanbul': 1.3, 'capetown': 1.4, 'mexico city': 1.3, 'phuket': 1.0,
    'bali': 0.7, 'bangkok': 0.8, 'hanoi': 0.6, 'ho chi minh': 0.6, 'vienna': 1.5, 'kolkata': 0.7,
    'kathmandu': 0.5, 'pokhara': 0.5, 'jaipur': 0.8, 'rishikesh': 0.7,
    'vietnam': 0.7, 'thailand': 0.8, 'malaysia': 1.0, 'bali': 0.7, 'europe': 2.2, 'usa': 2.5, 'uae': 2.0
};

function _heuristicClassify(daysPerCity, totalBudget) {
    const MIN_DAILY_INR = 3000;
    const totalDays = daysPerCity.reduce((sum, d) => sum + d.days, 0) || 1;
    const baselineTotal = totalDays * MIN_DAILY_INR;
    let remainingBudget = Math.max(0, totalBudget - baselineTotal);

    const totalWeightedDays = daysPerCity.reduce((sum, d) => {
        const cityLower = d.city.toLowerCase();
        let weight = 1.0;
        for (const [key, val] of Object.entries(COST_INDEX_MAP)) {
            if (cityLower.includes(key)) { weight = val; break; }
        }
        return sum + (d.days * weight);
    }, 0) || 1;

    console.log(`Debug: totalWeightedDays = ${totalWeightedDays}`);
    console.log(`Debug: remainingBudget = ${remainingBudget}`);

    const result = {};
    daysPerCity.forEach(d => {
        const cityLower = d.city.toLowerCase();
        let weight = 1.0;
        for (const [key, val] of Object.entries(COST_INDEX_MAP)) {
            if (cityLower.includes(key)) { weight = val; break; }
        }
        
        const baselineForCity = d.days * MIN_DAILY_INR;
        const surplusForCity = ( (d.days * weight) / totalWeightedDays ) * remainingBudget;
        
        console.log(`Debug: ${d.city} weight = ${weight}, baseline = ${baselineForCity}, surplus = ${surplusForCity}`);

        result[d.city] = {
            allocation: Math.round(baselineForCity + surplusForCity),
            reasoning: `Market-weighted (${weight > 1.2 ? 'Premium' : weight < 0.9 ? 'Budget' : 'Standard'}) with sustainable daily floor.`
        };
    });
    return result;
}

const daysPerCity = [{ city: 'Dubai', days: 3 }, { city: 'Bangkok', days: 3 }];
const totalBudget = 3450000;
console.log(JSON.stringify(_heuristicClassify(daysPerCity, totalBudget), null, 2));
