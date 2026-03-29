const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GENERATIVE_AI_API_KEY);

/**
 * Stage 1: Minimum Budget Feasibility Analyzer
 * Calculates (Base Daily Cost * Days) + Flight and checks if Budget is sufficient.
 * If insufficient, suggests alternative destinations or shorter stays.
 */
const analyzeBudgetFeasibility = async (destinations, budgetINR, days, currentLocation, multiCurrencyContext) => {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
        As an expert travel planner, analyze the feasibility of a ${days}-day trip to ${destinations.join(', ')} from ${currentLocation}.
        Total Budget Available: ${parseInt(budgetINR).toLocaleString()} INR.
        
        LOGIC FOR ANALYSIS:
        1. Calculate estimated base costs (Hotel, Food, Transport, Basic Activities) for ${destinations.join(', ')}.
        2. Include estimated flight/travel costs from ${currentLocation}.
        3. MULTI-CITY BUDGET ALLOCATION RULE: Do NOT split the budget evenly (50-50). You MUST allocate the budget proportionally based on each specific destination's actual cost of living. For example, Paris requires a vastly higher daily food and hotel allocation than Bali. Split the ${parseInt(budgetINR).toLocaleString()} INR realistically.
        4. If Total Estimated Cost > Budget:
           - feasible: false
           - Suggest shorter trip duration (e.g., if 7 days is too much, suggest 4).
           - Suggest increasing budget to [Calculated Needed Amount].
           - Suggest 2-3 cheaper alternative destinations that FIT this budget.
        5. If Total Estimated Cost <= Budget:
           - feasible: true
           - Provide a granular per-city breakdown in INR.

        CRITICAL: Return ONLY a valid JSON object. No markdown. All financial numerical values MUST be evaluated in INR.
        
        Expected structure:
        {
            "feasible": boolean,
            "message": "Direct summary (e.g., 'Budget is tight but manageable')",
            "cityBreakdown": [
                {
                    "city": "Name",
                    "minFlights": number,
                    "minHotels": number,
                    "minFood": number,
                    "totalMin": number
                }
            ],
            "suggestions": ["Specific actionable advice 1", "Alternative City A"]
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("Gemini Feasibility Error:", error);
        throw new Error(error.message || "AI analysis failed.");
    }
};

/**
 * Stage 2: Time-Block Itinerary Generator
 */
const generateItinerary = async (destinations, budget, days, currentLocation, allocation, weatherData) => {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
        Generate a detailed, time-blocked itinerary for a ${days}-day trip to ${destinations.join(', ')}.
        Budget Allocation per City (INR): ${JSON.stringify(allocation)}.
        Weather Context: ${JSON.stringify(weatherData)}.
        
        ITINERARY RULES:
        1. Each day must be divided into: Morning, Afternoon, Evening, Night.
        2. Cost Control: Each city's total costs MUST stay within its provided "totalMin" allocation.
        3. Real-World Hotels: Suggest real-world HOTELs based on for each city's "minHotels" budget.
        4. Weather Response: If rainy, suggest indoor attractions.
        5. Itinerary Format: Provide an array of objects inside the "days" key. No markdown ticks.


        CRITICAL: JSON-only output. No markdown. No triple backticks.

        
        Expected structure:
        {
            "days": [
                {
                    "day": number,
                    "city": "Name",
                    "hotelSuggestion": { "name": "...", "estimatedCostPerNight": number, "description": "..." },
                    "blocks": {
                        "Morning": [ { "time": "HH:MM", "place": "Name", "cost": number, "category": "Food|Transport|Activity", "description": "..." } ],
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
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("Gemini Itinerary Error:", error);
        throw new Error(error.message || "Failed to generate itinerary. AI response was invalid.");
    }
};

/**
 * Stage 3: Dynamic Rebalancing Engine
 */
const rescheduleItinerary = async (remainingItinerary, missedActivity, remainingBudget, currentLocation) => {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
        RE-BALANCE ITINERARY:
        The user MISSED this activity: ${JSON.stringify(missedActivity)}.
        Remaining Schedule: ${JSON.stringify(remainingItinerary)}.
        Remaining Budget (approximate): ${remainingBudget} INR.
        
        INSTRUCTIONS:
        1. Reschedule the missed activity to a later, empty or less crowded time block.
        2. Adjust other activities if necessary to fit the time.
        3. Keep the same structure for days, blocks, etc.
        
        CRITICAL: Return ONLY a valid JSON object matching the exact format below. No markdown formatting or ticks.

        Expected output schema:
        [
            {
                "day": number,
                "city": "Name",
                "hotelSuggestion": { "name": "...", "estimatedCostPerNight": number, "description": "..." },
                "blocks": {
                    "Morning": [ { "time": "HH:MM", "place": "Name", "cost": number, "category": "Food|Transport|Activity", "description": "..." } ],
                    "Afternoon": [...],
                    "Evening": [...],
                    "Night": [...]
                },
                "dailyBudgetUsed": number
            }
        ]
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("Gemini Reschedule Error:", error);
        throw new Error("Dynamic rescheduling failed due to AI response issue.");
    }
};

module.exports = { analyzeBudgetFeasibility, generateItinerary, rescheduleItinerary };
