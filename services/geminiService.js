const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GENERATIVE_AI_API_KEY);

/**
 * Stage 1: Minimum Budget Feasibility Analyzer
 * Calculates (Base Daily Cost * Days) + Flight and checks if Budget is sufficient.
 * If insufficient, suggests alternative destinations or shorter stays.
 */
const analyzeBudgetFeasibility = async (destinations, budget, days, currentLocation, currency = 'INR') => {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
        As an expert travel planner, analyze the feasibility of a ${days}-day trip to ${destinations.join(', ')} from ${currentLocation}.
        Total Budget: ${parseInt(budget).toLocaleString()} ${currency}.
        
        LOGIC FOR ANALYSIS:
        1. Calculate estimated base costs (Hotel, Food, Transport, Basic Activities) for ${destinations.join(', ')}.
        2. Include estimated flight/travel costs from ${currentLocation}.
        3. If Total Estimated Cost > Budget:
           - feasible: false
           - Suggest shorter trip duration (e.g., if 7 days is too much, suggest 4).
           - Suggest increasing budget to [Calculated Needed Amount].
           - Suggest 2-3 cheaper alternative destinations (e.g., Vietnam, Thailand, or domestic Indian states) that FIT this budget.
        4. If Total Estimated Cost <= Budget:
           - feasible: true
           - Provide a granular per-city breakdown.

        CRITICAL: Return ONLY a valid JSON object. No markdown.
        
        Expected structure:
        {
            "feasible": boolean,
            "message": "Direct summary (e.g., 'Budget is tight but manageable' or 'Budget is insufficient for this luxury destination')",
            "cityBreakdown": [
                {
                    "city": "Name",
                    "minFlights": number,
                    "minHotels": number,
                    "minFood": number,
                    "totalMin": number
                }
            ],
            "suggestions": ["Specific actionable advice 1", "Alternative City A", "Alternative City B"]
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("Gemini Feasibility Error:", error);
        throw new Error("AI analysis failed to generate. Please check your API key.");
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
        2. Total cost MUST be within the provided budget allocation for each city.
        3. Suggest a specific HOTEL for each city that fits the "Hotels" portion of the budget allocation.
        4. Adjust activities based on the "Weather Context" (e.g., if Rainy, suggest indoor activities).
        5. Include travel time/mode between activities.

        CRITICAL: Return ONLY a valid JSON object. No markdown.
        
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
        throw new Error("Failed to generate itinerary. AI response was invalid.");
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
        Remaining Budget: ${remainingBudget} INR.
        CRITICAL: Return ONLY a valid JSON object. No markdown.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("Gemini Reschedule Error:", error);
        throw new Error("Dynamic rescheduling failed.");
    }
};

module.exports = { analyzeBudgetFeasibility, generateItinerary, rescheduleItinerary };
