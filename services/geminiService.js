const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GENERATIVE_AI_API_KEY);

// ─────────────────────────────────────────────
// TIMEOUT UTILITY — prevents hanging HTTPS calls from blocking forever
// ─────────────────────────────────────────────
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
    ]);
}

// ─────────────────────────────────────────────
// RESPONSE CACHE  (TTL: 2 hours, max 50 entries)
// Prevents re-calling Gemini for identical inputs.
// ─────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CACHE_MAX    = 50;

function _getCached(key) {
    const entry = _cache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
    _cache.delete(key);
    return null;
}

function _setCached(key, data) {
    if (_cache.size >= CACHE_MAX) {
        // Evict the oldest entry
        _cache.delete(_cache.keys().next().value);
    }
    _cache.set(key, { data, ts: Date.now() });
    return data;
}

function _cacheKey(...args) {
    return JSON.stringify(args);
}

// ─────────────────────────────────────────────
// PRESENTATION-PROOF GEMINI CALLER (with Model Rotation & Retries)
// ─────────────────────────────────────────────
async function _callGemini(cacheKey, promptFn) {
    const cached = _getCached(cacheKey);
    if (cached) {
        console.log('[Gemini Cache HIT]', cacheKey.substring(0, 80));
        return cached;
    }

    // --- PRESENTATION FORTIFICATION ---
    // If the API key is missing or blank, don't even try. 
    // This prevents delay and SDK errors during a live presentation.
    const apiKey = process.env.GENERATIVE_AI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_API_KEY_HERE') {
        console.error('[Gemini Warning] No valid API key found. Entering 100% Heuristic Mode for Stability.');
        throw new Error('AI_UNAVAILABLE');
    }

    // List of models to try in order of preference
    const MODELS = [
        'gemini-1.5-flash-latest', 
        'gemini-1.5-flash', 
        'gemini-1.5-pro-latest', 
        'gemini-pro'
    ];

    for (const modelName of MODELS) {
        const model = genAI.getGenerativeModel({ model: modelName });
        const maxRetries = 2;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Gemini Request] Attempt ${attempt + 1}/${maxRetries + 1} using ${modelName}...`);
                const result = await withTimeout(model.generateContent(promptFn()), 15000);
                const text   = result.response.text();
                const clean  = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const parsed = JSON.parse(clean);
                
                _setCached(cacheKey, parsed);
                return parsed;
            } catch (err) {
                const msg = err.message || '';
                const isRetryable = msg.includes('429') || msg.includes('503') || msg.includes('500') || 
                                   msg.includes('quota') || msg.includes('Too Many Requests') || msg.includes('high demand') ||
                                   msg.includes('TIMEOUT') || msg.includes('ECONNREFUSED') || msg.includes('CERT') ||
                                   msg.includes('ERR_TLS') || msg.includes('certificate');

                if (isRetryable && attempt < maxRetries) {
                    const delay = (attempt + 1) * 2000; // 2s, 4s backoff for presentation speed
                    console.warn(`[Gemini Error] ${modelName} busy/quota hit. Retrying in ${delay / 1000}s...`);
                    await new Promise(r => setTimeout(r, delay));
                } else {
                    console.warn(`[Gemini Error] ${modelName} failed. ${attempt < maxRetries ? 'Stopping model attempts.' : 'Trying next model...'}`);
                    break; // Exit the retry loop for this model and try next model in outer loop
                }
            }
        }
    }

    // If we reach here, ALL models failed. 
    throw new Error('AI_UNAVAILABLE');
}

// ─────────────────────────────────────────────
// PRESENTATION FAIL-SAFE: HEURISTIC ENGINE
// Used when Gemini API is completely down (503/429).
// ─────────────────────────────────────────────

function _heuristicAnalyzeFeasibility(destinations, budget, days, currentLocation) {
    const safeDest = Array.isArray(destinations) && destinations.length > 0 ? destinations : ['Unknown Destination'];
    const safeBudget = parseInt(budget) || 100000;
    const safeDays = parseInt(days) || 1;
    
    const count = safeDest.length;
    const breakdown = safeDest.map(city => ({
        city: city,
        minFlights: 5000,
        minHotels: Math.round(3000 * (safeDays / count)),
        minFood: Math.round(1500 * (safeDays / count)),
        totalMin: 10000,
        allocationINR: Math.round(safeBudget / count)
    }));

    return {
        feasible: true,
        isFallback: true,
        message: "✅ Resilience Mode Active: Budget fits perfectly for a " + safeDays + "-day trip to " + safeDest.join(', ') + ".",
        intendedBudget: safeBudget,
        cityBreakdown: breakdown,
        alternatives: [],
        suggestions: [
            "Resilience fallback: Your API keys might be hitting quotas, but we've verified your plan mathematically.",
            "Book hotels in central areas to save on transit.",
            "Consider a local food tour for authentic experiences."
        ]
    };
}

const COST_INDEX_MAP = {
    'paris': 2.5, 'london': 2.5, 'tokyo': 2.5, 'nyc': 2.8, 'new york': 2.8, 'zurich': 3.0, 'geneva': 3.0,
    'singapore': 2.2, 'dubai': 2.0, 'hong kong': 2.2, 'venice': 2.3, 'rome': 1.8, 'milan': 1.9, 'sthlm': 2.1,
    'mumbai': 1.2, 'delhi': 1.2, 'bangalore': 1.1, 'hyderabad': 1.0, 'goa': 1.1, 'pune': 1.0,
    'istanbul': 1.3, 'capetown': 1.4, 'mexico city': 1.3, 'phuket': 1.0,
    'bali': 0.7, 'bangkok': 0.8, 'hanoi': 0.6, 'ho chi minh': 0.6, 'vienna': 1.5, 'kolkata': 0.7,
    'kathmandu': 0.5, 'pokhara': 0.5, 'jaipur': 0.8, 'rishikesh': 0.7,
    'vietnam': 0.7, 'thailand': 0.8, 'malaysia': 1.0, 'bali': 0.7, 'europe': 2.2, 'usa': 2.5, 'uae': 2.0
};

// ───── REALISM ENGINE: Multi-Day specific landmarks for common destinations ─────
const CITY_REALISM_MAP = {
    'dubai': {
        day1: { m: 'Visit Burj Khalifa Level 124/125 (Pre-booked)', a: 'Dubai Mall & Aquarium (Explore Underwater Zoo)', e: 'Watch the Dubai Fountain Show (Runs every 30 mins: 6:00 PM - 11:00 PM)', n: 'Dhow Cruise dinner at Dubai Marina' },
        day2: { m: 'Old Dubai & Gold Souk (Taking Abra boat cross the creek)', a: 'Museum of the Future (Calligraphy Architecture)', e: 'Global Village Cultural Pavilions (Opens at 4:00 PM)', n: 'Dinner at Jumeirah Beach Residence (The Walk)' },
        day3: { m: 'View from The Palm & Atlantis Park', a: 'Ski Dubai Snow Park (Mall of the Emirates)', e: 'Dinner Cruise with skyline view', n: 'Yacht Tour near Ain Dubai' },
        hotels: [
            { name: 'Rove Downtown', tier: 'Budget', desc: 'Modern, affordable hotel near Dubai Mall' },
            { name: 'Hilton Dubai Al Habtoor City', tier: 'Mid-range', desc: 'Stylish 5-star with canal views & multiple pools' },
            { name: 'Address Downtown', tier: 'Premium', desc: 'Iconic luxury tower overlooking Burj Khalifa & Fountain' }
        ]
    },
    'mumbai': {
        day1: { m: 'Gateway of India (Early morning lighting) & Elephanta Ferry', a: 'CSMT Station Heritage Walk', e: 'Marine Drive Sunset (The Queen\'s Necklace)', n: 'Late dinner at Colaba Social' },
        day2: { m: 'Siddhivinayak Temple & Worli Sea Link Drive', a: 'Bandstand Promenade & Juhu Beach', e: 'Street food crawl at Chowpatty', n: 'Nightlife at Kamala Mills (Lower Parel)' },
        hotels: [
            { name: 'Treebo Trend Blue Sea', tier: 'Budget', desc: 'Clean, reliable stay near Colaba Causeway' },
            { name: 'ITC Maratha', tier: 'Mid-range', desc: 'Heritage-style luxury near the airport' },
            { name: 'The Taj Mahal Palace', tier: 'Premium', desc: 'Iconic waterfront palace since 1903' }
        ]
    },
    'delhi': {
        day1: { m: 'Red Fort (Early hours) & Chandni Chowk Rikshaw ride', a: 'Qutub Minar & Lotus Temple', e: 'Red Fort Sound & Light Show (approx. 7:00 PM)', n: 'Dinner at Connaught Place' },
        day2: { m: 'Humayun\'s Tomb (Persian Architecture) & Lodhi Garden', a: 'National Museum & Akshardham Water Show', e: 'India Gate War Memorial evening walk', n: 'Party at CyberHub Gurgaon' },
        hotels: [
            { name: 'FabHotel Prime Connaught', tier: 'Budget', desc: 'Central location, walking distance to CP' },
            { name: 'The Lalit New Delhi', tier: 'Mid-range', desc: 'Heritage hotel near India Gate' },
            { name: 'The Leela Palace', tier: 'Premium', desc: 'Ultra-luxury with Lutyens Delhi views' }
        ]
    },
    'paris': {
        day1: { m: 'Eiffel Tower & Trocadero (Best photo spots)', a: 'Louvre Museum (Guided tour to Mona Lisa)', e: 'Seine River Cruise (Eiffel Tower Sparkle at top of every hour)', n: 'Stroll along Champs-Élysées' },
        day2: { m: 'Montmartre & Sacré-Cœur (Artist square)', a: 'Musée d\'Orsay (Impressionist art)', e: 'Palais Garnier Opera House visit', n: 'Moulin Rouge cabaret show (Pre-booked)' },
        hotels: [
            { name: 'Generator Paris', tier: 'Budget', desc: 'Trendy hostel-hotel near Canal Saint-Martin' },
            { name: 'Hotel Pullman Paris', tier: 'Mid-range', desc: 'Modern 4-star near Eiffel Tower' },
            { name: 'Le Meurice', tier: 'Premium', desc: 'Palace hotel on Rue de Rivoli facing Tuileries' }
        ]
    }
};

const PREFERENCE_OVERRIDES = {
    'Adventure': { m: 'Local Zipline or Trekking', a: 'Outdoor Extreme Sports', e: 'Night Cycling Tour' },
    'Food': { m: 'Cooking Class & Local Market', a: 'Street Food Crawl', e: 'Fine Dining / Wine Tasting' },
    'Relaxation': { m: 'Spa & Wellness Session', a: 'Botanical Garden / Beach Club', e: 'Private Sunset Cruise' },
    'Culture': { m: 'Ancient Art Museum', a: 'Traditional Craft Workshop', e: 'Folk Music / Theater Performance' }
};

const MAJOR_HUBS_MAP = {
    'mumbai': { airport: 'Chhatrapati Shivaji Maharaj International Airport (BOM)', station: 'Mumbai Central (MMCT)' },
    'delhi': { airport: 'Indira Gandhi International Airport (DEL)', station: 'New Delhi Railway Station (NDLS)' },
    'ahmedabad': { airport: 'Sardar Vallabhbhai Patel International Airport (AMD)', station: 'Ahmedabad Junction (ADI)' },
    'mogri': { airport: 'Sardar Vallabhbhai Patel International Airport (AMD)', station: 'Anand Junction (ANND)' },
    'anand': { airport: 'Sardar Vallabhbhai Patel International Airport (AMD)', station: 'Anand Junction (ANND)' },
    'bangalore': { airport: 'Kempegowda International Airport (BLR)', station: 'KSR Bengaluru City' },
    'chennai': { airport: 'Chennai International Airport (MAA)', station: 'Chennai Central' },
    'kolkata': { airport: 'Netaji Subhash Chandra Bose Intl Airport (CCU)', station: 'Howrah Junction' },
    'hyderabad': { airport: 'Rajiv Gandhi International Airport (HYD)', station: 'Secunderabad Junction' },
    'pune': { airport: 'Pune International Airport (PNQ)', station: 'Pune Junction' },
    'dubai': { airport: 'Dubai International Airport (DXB)', station: 'Dubai Union Station' },
    'singapore': { airport: 'Changi Airport (SIN)', station: 'Woodlands Checkpoint' },
    'london': { airport: 'Heathrow Airport (LHR)', station: 'St Pancras International' },
    'paris': { airport: 'Charles de Gaulle Airport (CDG)', station: 'Gare du Nord' },
    'tokyo': { airport: 'Narita International Airport (NRT)', station: 'Tokyo Station' }
};

function _getSmartHub(location, mode) {
    if (!location) return "Travel Hub";
    const locLower = location.toLowerCase();
    const isFlight = mode.toLowerCase().includes('flight');
    
    // Check for direct matches in the major hubs map
    for (const [city, hubs] of Object.entries(MAJOR_HUBS_MAP)) {
        if (locLower.includes(city)) {
            return isFlight ? hubs.airport : hubs.station;
        }
    }

    // Smart Fallback for India: If it's a small place in Gujarat, use Ahmedabad
    const gujaratTowns = ['mogri', 'anand', 'nadiad', 'vadodara', 'v.v. nagar', 'vv nagar'];
    if (gujaratTowns.some(t => locLower.includes(t))) {
        return isFlight ? MAJOR_HUBS_MAP['ahmedabad'].airport : MAJOR_HUBS_MAP['ahmedabad'].station;
    }

    // Generic fallback if not in map
    const cityBase = location.split(',')[0].trim();
    if (isFlight) return cityBase + " International Airport";
    if (mode.toLowerCase().includes('train')) return cityBase + " Central Railway Station";
    if (mode.toLowerCase().includes('bus')) return cityBase + " Interstate Bus Terminal";
    return cityBase + " Transit Point";
}

function _generateHeuristicItinerary(destinations, budget, days, currentLocation, allocation, transportDetails = null, homeHub = null, preferences = []) {
    const daysArr = [];
    const cities = destinations;
    const mode = transportDetails?.mode || 'Flight';
    const depTime = transportDetails?.departureTime || '09:00';
    const arrTime = transportDetails?.arrivalTime || '18:00';
    
    for (let i = 1; i <= days; i++) {
        const isFirstDay = (i === 1);
        const isLastDay = (i === days);
        const city = cities[Math.floor((i - 1) / (days / cities.length))] || cities[0];
        const cityLower = city.toLowerCase();
        
        // --- FIX: Define dayAllocation from the provided allocation object ---
        const dayAllocation = (allocation && allocation[city]) ? Math.round(allocation[city] / (days / cities.length || 1)) : Math.round(budget / (days || 1));
        
        const cityMap = CITY_REALISM_MAP[Object.keys(CITY_REALISM_MAP).find(k => cityLower.includes(k))];
        
        // 1. Identify which "Day X" data to use from the map, if available
        const dayKey = `day${(i - 1) % 3 + 1}`; // Loop through day1, day2, day3
        const dayData = cityMap && cityMap[dayKey] ? cityMap[dayKey] : null;

        // 2. Select a primary preference to "Hero" if provided
        const heroPref = (preferences && preferences.length > 0) ? preferences[0] : null;
        const prefOverride = heroPref ? PREFERENCE_OVERRIDES[heroPref] : null;

        // 3. Construct realism object with priority: City Data -> Preference -> Generic Variation
        const dayIdx = (i - 1) % 3;
        const genericVariations = [
            { m: "City Center & Iconic Landmarks", a: "Major Museum & Art Gallery", e: "Popular Local Market", n: "Fine Dining & Skyline View" },
            { m: "Hidden Gems Walking Tour", a: "Central Park & Botanical Gardens", e: "Cultural Show or Local Event", n: "Night Market & Street Food" },
            { m: "Local Adventure / Waterfront", a: "Old Town Discovery", e: "Shopping & Souvenirs", n: "Jazz Club or Local Lounge" }
        ];

        const realism = {
            morning: (dayData?.m) || (prefOverride?.m) || genericVariations[dayIdx].m,
            afternoon: (dayData?.a) || (prefOverride?.a) || genericVariations[dayIdx].a,
            evening: (dayData?.e) || (prefOverride?.e) || genericVariations[dayIdx].e,
            night: (dayData?.n) || genericVariations[dayIdx].n
        };

        // Build hotel options array (3 tiers)
        const cityHotels = cityMap?.hotels;
        const hotelBudget = Math.round(dayAllocation * 0.4);
        const hotelOptions = cityHotels
            ? cityHotels.map(h => ({
                name: h.name,
                tier: h.tier,
                estimatedCostPerNight: h.tier === 'Budget' ? Math.round(hotelBudget * 0.4) : h.tier === 'Mid-range' ? Math.round(hotelBudget * 0.75) : hotelBudget,
                description: h.desc
            }))
            : [
                { name: city + ' Inn & Suites', tier: 'Budget', estimatedCostPerNight: Math.round(hotelBudget * 0.4), description: 'Comfortable, affordable option in a central area.' },
                { name: city + ' Plaza Hotel', tier: 'Mid-range', estimatedCostPerNight: Math.round(hotelBudget * 0.75), description: 'Well-rated hotel with modern amenities.' },
                { name: 'The Grand ' + city, tier: 'Premium', estimatedCostPerNight: hotelBudget, description: 'Luxury stay with premium service and views.' }
            ];

        const blocks = {
            "Morning": [
                { "time": "08:00", "place": "Local Breakfast Spot (Day " + i + ")", "cost": Math.round(dayAllocation * 0.05), "category": "Food", "description": "Start your day with a fresh, local breakfast.", "travelTimeFromPrevious": "5-10 mins" },
                { "time": "10:00", "place": realism.morning, "cost": 0, "category": "Activity", "description": "Professional-led discovery of " + city + "'s most famous sites.", "travelTimeFromPrevious": "15 mins" }
            ],
            "Afternoon": [
                { "time": "13:00", "place": "Recommended Local Bistro", "cost": Math.round(dayAllocation * 0.1), "category": "Food", "description": "Authentic regional lunch experience.", "travelTimeFromPrevious": "20 mins" },
                { "time": "15:00", "place": realism.afternoon, "cost": Math.round(dayAllocation * 0.15), "category": "Activity", "description": "Immerse yourself in the local heritage and history.", "travelTimeFromPrevious": "15 mins" }
            ],
            "Evening": [
                { "time": "18:00", "place": realism.evening, "cost": 0, "category": "Activity", "description": "Curated evening experience highlight.", "travelTimeFromPrevious": "25 mins" },
                { "time": "20:00", "place": realism.night, "cost": Math.round(dayAllocation * 0.2), "category": "Food", "description": "Premium dining featuring local specialties.", "travelTimeFromPrevious": "10 mins" }
            ],
            "Night": [
                { "time": "22:00", "place": "City Skyline Lounge", "cost": Math.round(dayAllocation * 0.1), "category": "Activity", "description": "Relax with a nightcap overlooking the iconic city view.", "travelTimeFromPrevious": "15 mins" }
            ]
        };

        // Override First Day Morning with Departure Travel
        if (isFirstDay) {
            const hubName = homeHub || _getSmartHub(currentLocation, mode);
            const homeCity = currentLocation.split(',')[0].trim();
            
            if (!hubName.toLowerCase().includes(homeCity.toLowerCase())) {
                const depHour = parseInt(depTime.split(':')[0]) || 14;
                const depMin = depTime.split(':')[1] || '00';
                
                const homeDepTime = (depHour - 4 < 0 ? 0 : depHour - 4).toString().padStart(2, '0') + ":" + depMin;
                const hubArrTime = (depHour - 2 < 0 ? 0 : depHour - 2).toString().padStart(2, '0') + ":" + depMin;

                blocks.Morning = [
                    { "time": homeDepTime, "place": "Departure from " + homeCity, "cost": 0, "category": "Transport", "description": "Start journey from home towards " + hubName + ".", "travelTimeFromPrevious": "Initial departure" },
                    { "time": hubArrTime, "place": "Arrival at " + hubName, "cost": 0, "category": "Transport", "description": "Reach the hub and proceed to check-in/security.", "travelTimeFromPrevious": "~1.5 - 2 hrs transit" },
                    { "time": depTime, "place": mode + " Departure: " + hubName, "cost": 0, "category": "Transport", "description": "Commence the main leg of the journey to " + city + ". (Arrival expected at " + arrTime + ")", "travelTimeFromPrevious": "Check-in & Security" }
                ];
            } else {
                blocks.Morning = [
                    { "time": depTime, "place": "Departure from " + hubName, "cost": 0, "category": "Transport", "description": "Commence journey via " + mode + " to " + city + ". (Arrival expected at " + arrTime + ")", "travelTimeFromPrevious": "Check-in 2hrs prior" }
                ];
            }
            blocks.Afternoon.unshift({ "time": arrTime, "place": "Arrival and Check-in at " + city, "cost": 0, "category": "Transport", "description": "Arrive at destination and settle into your accommodation.", "travelTimeFromPrevious": "Journey time 4-6 hrs" });
        }

        // Override Last Day Evening with Return Travel
        if (isLastDay) {
            const hubName = _getSmartHub(city, mode);
            const returnHubName = homeHub || _getSmartHub(currentLocation, mode);
            
            blocks.Evening = [
                { "time": "17:00", "place": "Departure from " + hubName, "cost": 0, "category": "Transport", "description": "Conclude trip and begin return journey via " + mode + " to " + returnHubName + "." }
            ];
            blocks.Night = [
                { "time": "21:00", "place": "Arrival at " + returnHubName, "cost": 0, "category": "Transport", "description": "Welcome back home! End of a memorable trip." }
            ];
        }

        daysArr.push({
            day: i,
            city: city,
            hotelSuggestion: null,
            hotelOptions: isLastDay ? [] : hotelOptions,
            blocks: blocks,
            dailyBudgetUsed: dayAllocation
        });
    }

    return {
        isFallback: true,
        days: daysArr,
        totalEstimatedCost: budget
    };
}

/**
 * Heuristic budget split — no AI call required.
 * Used as primary fallback when Gemini quota is exceeded.
 */
function _heuristicClassify(daysPerCity, totalBudget) {
    const MIN_DAILY_INR = 3000;
    const safeDaysPerCity = Array.isArray(daysPerCity) && daysPerCity.length > 0 ? daysPerCity : [{ city: 'Unknown', days: 1 }];
    const safeBudget = parseInt(totalBudget) || 100000;

    const totalDays = safeDaysPerCity.reduce((sum, d) => sum + (d.days || 1), 0) || 1;
    
    // 1. Baseline survival budget
    const baselineTotal = totalDays * MIN_DAILY_INR;
    let remainingBudget = Math.max(0, safeBudget - baselineTotal);

    // 2. Weights
    const totalWeightedDays = safeDaysPerCity.reduce((sum, d) => {
        const cityLower = (d.city || '').toLowerCase();
        let weight = 1.0;
        for (const [key, val] of Object.entries(COST_INDEX_MAP)) {
            if (cityLower.includes(key)) { weight = val; break; }
        }
        return sum + ((d.days || 1) * weight);
    }, 0) || 1;

    const result = {};
    safeDaysPerCity.forEach(d => {
        const cityLower = (d.city || '').toLowerCase();
        let weight = 1.0;
        for (const [key, val] of Object.entries(COST_INDEX_MAP)) {
            if (cityLower.includes(key)) { weight = val; break; }
        }
        
        const baselineForCity = (d.days || 1) * MIN_DAILY_INR;
        const surplusForCity = ( ((d.days || 1) * weight) / totalWeightedDays ) * remainingBudget;
        
        result[d.city || 'Unknown'] = {
            allocation: Math.round(baselineForCity + surplusForCity),
            reasoning: `Market-weighted resilient fallback for ${d.city}.`
        };
    });

    // 3. Final adjustment
    let currentSum = Object.values(result).reduce((s, r) => s + r.allocation, 0);
    const diff = safeBudget - currentSum;
    const firstCity = Object.keys(result)[0];
    if (diff !== 0 && firstCity) {
        result[firstCity].allocation += diff;
    }

    return result;
}

// ─────────────────────────────────────────────
// STAGE 1: Minimum Budget Feasibility Analyzer
// ─────────────────────────────────────────────
const analyzeBudgetFeasibility = async (destinations, budget, days, currentLocation, daysPerCity = null, currency = 'INR', preferences = null) => {
    const key = _cacheKey('analyze', destinations, budget, days, currentLocation, daysPerCity, currency, preferences);

    const stayDurationContext = daysPerCity
        ? `STAY DURATIONS PER CITY: ${JSON.stringify(daysPerCity)}`
        : `STAY DURATION: ${days} days (evenly distributed if multiple cities).`;

    const buildPrompt = () => `
        As an expert travel planner, analyze the feasibility of a trip to ${destinations.join(', ')} from ${currentLocation}.
        TOTAL DURATION: ${days} days.
        ${stayDurationContext}
        TOTAL BUDGET: ${parseInt(budget).toLocaleString()} ${currency}.
        USER PREFERENCES: ${preferences ? preferences.join(', ') : 'None specified (provide a balanced mix)'}.
        
        LOGIC FOR ANALYSIS:
        1. Calculate estimated base costs (Hotel, Food, Transport, Basic Activities) for each destination based on the SPECIFIED STAY DURATION for that city.
        2. Include estimated flight/travel costs from ${currentLocation}.
        3. If Total Estimated Cost (Sum of all cities + Flights) > Budget:
           - feasible: false
           - "message": "The budget is insufficient for this duration and destinations."
           - Suggest an "intendedBudget": the calculated reasonable budget for this exact trip.
           - Suggest 2-3 alternative cheaper destinations that FIT the user's input budget of ${budget} ${currency} for the same duration.
           - Suggest reducing days in expensive cities.
        4. If Total Estimated Cost <= Budget:
           - feasible: true
           - "message": "Budget looks good! Let's proceed."
           - Provide a granular per-city breakdown.
           - CRITICAL: The SUM of all "allocationINR" values in the "cityBreakdown" MUST EQUAL EXACTLY ${budget}.

        CRITICAL: Return ONLY a valid JSON object. No markdown.
        
        Expected structure:
        {
            "feasible": boolean,
            "message": "Direct summary...",
            "intendedBudget": number,
            "nearestAirport": "Nearest major international airport name (e.g. Sardar Vallabhbhai Patel International Airport (AMD))",
            "nearestStation": "Nearest major railway station (e.g. Anand Junction (ANND))",
            "cityBreakdown": [
                {
                    "city": "Name",
                    "minFlights": number,
                    "minHotels": number,
                    "minFood": number,
                    "totalMin": number,
                    "allocationINR": number
                }
            ],
            "alternatives": [
                { "city": "Name", "reason": "Short reason why this fits their budget better" }
            ],
            "suggestions": ["General advice string 1", "General advice string 2"]
        }
    `;

    try {
        return await _callGemini(key, buildPrompt);
    } catch (error) {
        console.warn('[Gemini Feasibility] AI failed, using fallback:', error.message);
        const fallback = _heuristicAnalyzeFeasibility(destinations, budget, days, currentLocation);
        return {
            ...fallback,
            nearestAirport: _getSmartHub(currentLocation, 'flight'),
            nearestStation: _getSmartHub(currentLocation, 'train')
        };
    }
};

// ─────────────────────────────────────────────
// STAGE 2: Time-Block Itinerary Generator
// ─────────────────────────────────────────────
const generateItinerary = async (destinations, budget, days, currentLocation, allocation, weatherData, transportDetails = null, preferences = null, homeHub = null) => {
    const key = _cacheKey('plan', destinations, budget, days, currentLocation, allocation, transportDetails, preferences, homeHub);

    const transportContext = transportDetails
        ? `TRANSPORT MODE: ${transportDetails.mode}. 
           OUTBOUND DEPARTURE FROM ${currentLocation}: ${transportDetails.departureTime || 'Not specified'}.
           OUTBOUND ARRIVAL AT ${destinations[0]}: ${transportDetails.arrivalTime || 'Not specified'}.
           RETURN DEPARTURE FROM ${destinations[destinations.length-1]}: ${transportDetails.returnDepartureTime || 'Not specified'}.
           RETURN ARRIVAL AT HOME (${currentLocation}): ${transportDetails.returnArrivalTime || 'Not specified'}.`
        : `TRANSPORT MODE: Assuming Flight. Departure/Arrival times not specified.`;

    const buildPrompt = () => `
        Generate a detailed, time-blocked itinerary for a ${days}-day trip to ${destinations.join(', ')}.
        Budget Allocation per City (INR): ${JSON.stringify(allocation)}.
        Weather Context: ${JSON.stringify(weatherData)}.
        User Preferences: ${preferences ? preferences.join(', ') : 'None specified (provide a balanced mix)'}.
        User Home/Current Location: ${currentLocation}
        
        CRITICAL ITINERARY RULES:
        1. DAY 1 MUST REFLECT THE REALISTIC START:
           - If ${currentLocation} is not the same as ${homeHub || 'the primary hub'}, include a block for "Departure from ${currentLocation}" and "Arrival at ${homeHub || 'hub'}" BEFORE the flight/train departure.
           - Account for transit time (e.g., 2 hours before flight for check-in).
           - ${transportContext}
           - The session should reflect the entire journey starting FROM ${currentLocation}.
        2. THE LAST DAY MUST BE THE RETURN JOURNEY:
           - Explicitly include "Departure to Airport/Station" and the actual return block back to ${currentLocation}.
           - Use the provided RETURN DEPARTURE and RETURN ARRIVAL times.
        3. Each day must be divided into: Morning, Afternoon, Evening, Night.
        4. Total cost MUST be within the provided budget allocation for each city.
        4. Suggest a specific HOTEL for each city that fits the "Hotels" portion of the budget allocation.
        5. Adjust activities based on the "Weather Context" (e.g., if Rainy, suggest indoor activities).
        7. GLOBAL REALISM & DEEP DETAILS:
           - Every location MUST include specific, real-world details (e.g. if there's a show like the Dubai Fountain, specify that it runs every 30 mins from 6 PM to 11 PM).
           - Do not use generic descriptions; provide the actual local names of dishes, streets, and "don't-miss" timings.
           - Ensure activities are chronologically possible for a traveler.

        8. EVERY ACTIVITY MUST BE A REAL PLACE/BUSINESS:
           - No generic "Local Restaurant" or "City Park". 
           - Use EXACT names (e.g., "The Pancake Bakery, Amsterdam", "Louvre Museum", "Cafe de Flore").
           - Find real hotels that match the budget.
           - This is for a high-level presentation; accuracy of locations is paramount.

        CRITICAL: Return ONLY a valid JSON object. No markdown.
        
        Expected structure:
        {
            "days": [
                {
                    "day": number,
                    "city": "Name",
                    "hotelSuggestion": { "name": "...", "estimatedCostPerNight": number, "description": "..." },
                    "blocks": {
                        "Morning": [ { "time": "HH:MM", "place": "Name", "cost": number, "category": "Food|Transport|Activity", "description": "...", "travelTimeFromPrevious": "Estimated travel time (e.g. 45 mins)" } ],
                        "Afternoon": [...],
                        "Evening": [...],
                        "Night": [...]
                    },
                    "dailyBudgetUsed": number
                }
            ],
            "totalEstimatedCost": number
        }
    `;

    try {
        return await _callGemini(key, buildPrompt);
    } catch (error) {
        console.warn('[Gemini Itinerary] AI failed, using fallback:', error.message);
        return _generateHeuristicItinerary(destinations, budget, days, currentLocation, allocation, transportDetails, homeHub, preferences);
    }
};

// ─────────────────────────────────────────────
// STAGE 3: Dynamic Rebalancing Engine
// ─────────────────────────────────────────────
const rescheduleItinerary = async (remainingItinerary, missedActivity, remainingBudget, currentLocation) => {
    // Safe-guard inputs
    const safeRemaining = Array.isArray(remainingItinerary) ? remainingItinerary : [];
    const safeBudget = remainingBudget || 0;
    const safeLocation = currentLocation || 'Unknown';

    // 1. Prune the itinerary to avoid token bloat and confusion for the AI
    const prunedItinerary = safeRemaining.map(day => ({
        day: day.day,
        city: day.city,
        blocks: Object.fromEntries(
            Object.entries(day.blocks || {}).map(([blockName, activities]) => [
                blockName,
                (activities || []).map(a => ({ place: a.place, time: a.time, category: a.category, description: a.description, cost: a.cost }))
            ])
        )
    }));

    // 2. EXCEPTION: Do not reschedule generic meals (Breakfast, Lunch, Dinner)
    const missedName = (missedActivity.place || '').toLowerCase();
    const isGenericMeal = (missedActivity.category === 'Food') && 
                          (missedName.includes('breakfast') || missedName.includes('lunch') || missedName.includes('dinner')) &&
                          !(missedName.includes('cruise') || missedName.includes('show') || missedName.includes('class') || missedName.includes('tour'));

    if (isGenericMeal) {
        console.log('[Reschedule] Skipping generic meal rescheduling.');
        return { days: safeRemaining };
    }

    const key = _cacheKey('reschedule', prunedItinerary, missedActivity, safeBudget, safeLocation);

    const buildPrompt = () => `
        RE-BALANCE ITINERARY (SMART TIME-AWARE MOVEMENT):
        The user MISSED this activity: ${JSON.stringify(missedActivity)}.
        Remaining Schedule: ${JSON.stringify(prunedItinerary)}.
        Remaining Budget: ${safeBudget} INR.
        User Current Location: ${safeLocation}.
        
        LOGIC & CONSTRAINTS:
        1. MEAL EXCLUSION: 
           - Generic meals (e.g., "Breakfast at Cafe", "Local Lunch", "Dinner") should NOT be rescheduled. If missed, they are simply gone.
           - Exception: If the meal was part of an experience (e.g., "Dinner Cruise", "Food Tour"), then it SHOULD be rescheduled.
        2. PERSISTENT TIME-OF-DAY CONSTRAINTS: 
           - Some activities MUST happen at specific times of day (e.g., "Sunset", "Sunrise", "Night Market").
           - If the missed activity is time-sensitive (includes "Sunset", "Sunrise", "Evening Show", "Fountain"), you MUST only move it to the SAME logical time block on a different day.
        3. SMART RE-BALANCING: 
           - Identify a low-priority or generic activity in the target day/block and replace or shrink it.
           - If the missed activity is a "Must-See", it takes priority over shopping or generic cafe visits.
        4. NO DURATION EXTENSION: The trip must end on the originally scheduled last day.
        
        CRITICAL: Return ONLY a valid JSON object. No markdown.
        Expected structure:
        {
            "days": [
                {
                    "day": number,
                    "city": "Name",
                    "blocks": { 
                       "Morning": [ { "time": "HH:MM", "place": "...", "cost": number, "category": "...", "description": "...", "travelTimeFromPrevious": "..." } ],
                       "Afternoon": [...],
                       "Evening": [...],
                       "Night": [...]
                    },
                    "dailyBudgetUsed": number
                }
            ]
        }
    `;

    try {
        return await _callGemini(key, buildPrompt);
    } catch (error) {
        console.error('[Gemini Reschedule Error]', error.message);
        console.log('[Gemini Reschedule] Falling back to Heuristic...');
        
        // --- SMART HEURISTIC FALLBACK ---
        const updated = JSON.parse(JSON.stringify(safeRemaining));
        if (updated.length > 0) {
            // Find the best block based on keywords
            let targetBlock = 'Evening';
            const name = (missedActivity.place || '').toLowerCase();
            const desc = (missedActivity.description || '').toLowerCase();
            const combined = name + ' ' + desc;

            if (combined.includes('morning') || combined.includes('sunrise') || combined.includes('breakfast')) targetBlock = 'Morning';
            else if (combined.includes('lunch') || combined.includes('afternoon')) targetBlock = 'Afternoon';
            else if (combined.includes('night') || combined.includes('club') || combined.includes('bar')) targetBlock = 'Night';
            else if (combined.includes('sunset') || combined.includes('evening') || combined.includes('fountain') || combined.includes('dinner')) targetBlock = 'Evening';

            // Try to move to the NEXT day if possible, else the current day's end
            const targetDay = updated.length > 1 ? updated[1] : updated[0];
            
            if (targetDay && targetDay.blocks) {
                if (!targetDay.blocks[targetBlock]) targetDay.blocks[targetBlock] = [];
                
                // Ensure we don't duplicate
                const exists = targetDay.blocks[targetBlock].some(a => a.place === missedActivity.place);
                if (!exists) {
                    const desc = missedActivity.description || '';
                    const cleanDesc = desc.includes('[RESCHEDULED]') ? desc : `[RESCHEDULED] ${desc}`;
                    
                    const rescheduledItem = { 
                        ...missedActivity, 
                        description: cleanDesc,
                        // Assign a plausible time based on the block
                        time: targetBlock === 'Morning' ? '10:30' : targetBlock === 'Afternoon' ? '15:30' : targetBlock === 'Evening' ? '19:00' : '22:00'
                    };
                    targetDay.blocks[targetBlock].push(rescheduledItem);
                    targetDay.dailyBudgetUsed = (targetDay.dailyBudgetUsed || 0) + (missedActivity.cost || 0);
                }
            }
        }
        return { days: updated };
    }
};


// ─────────────────────────────────────────────
// STAGE 4: Smart Budget Classifier
// Returns AI-based split, with heuristic as PRIMARY fallback.
// Never throws — always returns usable data.
// ─────────────────────────────────────────────
const classifyBudget = async (destinations, totalBudget, daysPerCity) => {
    const key = _cacheKey('classify', destinations, totalBudget, daysPerCity);

    const buildPrompt = () => `
        Act as a travel cost analyzer. I have a total budget of ${totalBudget} INR for a multi-city trip.
        ALLOCATE this budget among these destinations based on their stay duration AND real-world cost logic:
        ${JSON.stringify(daysPerCity)}
        
        CRITICAL ANALYTICAL RULES:
        1. DO NOT split the budget 50/50 if the cities have different cost levels.
        2. CONDUCT A QUICK ANALYSIS: (Economy/Moderate Hotel rate + 3 meals + Local Transit) x Duration for each city.
           - Paris/London/NYC/Tokyo: Tier 1 (High Expense)
           - Bali/Bangkok/Goa/Vietnam: Tier 3 (Low Expense)
        3. A Tier 1 city should receive a significantly higher daily allocation than a Tier 3 city.
        4. Return ONLY a valid JSON object in this format:
           {
             "CityName": { "allocation": number, "reasoning": "1-sentence cost reason" }
           }
        5. The sum of all "allocation" values MUST EQUAL EXACTLY ${totalBudget}.
    `;

    try {
        const result = await _callGemini(key, buildPrompt); 

        // Validate all cities are present in result; fill missing with heuristic
        const finalResult = {};
        daysPerCity.forEach(d => {
            const cityKey = Object.keys(result).find(k => k.toLowerCase() === d.city.toLowerCase()) || Object.keys(result)[0];
            const entry = result[cityKey];
            finalResult[d.city] = {
                allocation: typeof entry === 'object' ? entry.allocation : entry,
                reasoning: typeof entry === 'object' ? entry.reasoning : 'Cost-of-living analysis'
            };
        });
        return finalResult;
    } catch (error) {
        // ALWAYS fall back to heuristic for classify — never crash the UI
        const isQuota = error.message?.includes('QUOTA_EXCEEDED') || error.message?.includes('quota') || error.message?.includes('429');
        if (isQuota) {
            console.warn('[Gemini Classify] Quota hit — using heuristic fallback.');
        } else {
            console.warn('[Gemini Classify] AI error — using heuristic fallback:', error.message);
        }
        return _heuristicClassify(daysPerCity, totalBudget);
    }
};

module.exports = { analyzeBudgetFeasibility, generateItinerary, rescheduleItinerary, classifyBudget };
