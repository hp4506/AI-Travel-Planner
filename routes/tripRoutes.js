const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const currencyService = require('../services/currencyService');
const weatherService = require('../services/weatherService');
const storageService = require('../services/storageService');
const { db } = require('../config/firebaseConfig');
const dotenv = require('dotenv');

dotenv.config();

// Configuration Endpoint for Frontend
router.get('/config/firebase', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    });
});

// 1. Minimum Budget Analysis
router.post('/analyze', async (req, res) => {
    try {
        const { destinations, budget, days, currentLocation, isInternational, daysPerCity, preferences } = req.body;
        
        // Pass the optional daysPerCity and preferences to the AI for duration-aware and tailored analysis
        const analysis = await geminiService.analyzeBudgetFeasibility(destinations, budget, days, currentLocation, daysPerCity, 'INR', preferences);
        
        // Enrich the analysis with currency conversions for each city
        if (analysis.cityBreakdown) {
            for (let i = 0; i < analysis.cityBreakdown.length; i++) {
                try {
                    const cityInfo = analysis.cityBreakdown[i];
                    const dest = cityInfo.city;
                    const currencyInfo = currencyService.getCurrencyInfo(dest);
                    
                    const conversion = await currencyService.convertToLocalCurrency(cityInfo.allocationINR || cityInfo.totalMin || 0, dest);
                    cityInfo.localCurrency = {
                        symbol: conversion.symbol || currencyInfo.symbol || '₹',
                        code: conversion.currency || currencyInfo.code || 'INR',
                        rate: conversion.rate || 1,
                        amount: conversion.amount || cityInfo.allocationINR || 0
                    };
                } catch (innerErr) {
                    console.warn('[Analysis Enrichment] Skipping currency conversion for a city due to error:', innerErr.message);
                }
            }
        }
        
        res.status(200).json(analysis);
    } catch (error) {
        console.error('--- CRITICAL ERROR IN ANALYSIS ---');
        console.error(error.stack || error);
        // This should theoretically not be reached due to service-level fallbacks
        res.status(500).json({ error: 'An unexpected error occurred. Please try again soon.' });
    }
});

// 2. Generate Itinerary (Weather Aware)
router.post('/plan', async (req, res) => {
    try {
        const { destinations, budget, days, currentLocation, allocation, transportDetails, preferences, homeHub } = req.body;
        
        // Fetch weather context before generating
        const weatherData = await weatherService.getDestinationsWeather(destinations);
        
        const itinerary = await geminiService.generateItinerary(destinations, budget, days, currentLocation, allocation, weatherData, transportDetails, preferences, homeHub);
        res.status(200).json({ ...itinerary, weatherContext: weatherData });
    } catch (error) {
        console.error('--- CRITICAL ERROR IN PLANNING ---');
        console.error(error.stack || error);
        res.status(500).json({ error: 'Failed to generate plan. Please try again.' });
    }
});


// 3. Dynamic Rescheduling
router.post('/reschedule', async (req, res) => {
    try {
        const { remainingItinerary, missedActivity, remainingBudget, currentLocation } = req.body;
        const updatedItinerary = await geminiService.rescheduleItinerary(remainingItinerary, missedActivity, remainingBudget, currentLocation);
        res.status(200).json(updatedItinerary);
    } catch (error) {
        console.error('Error rescheduling:', error);
        res.status(500).json({ error: 'Failed to reschedule' });
    }
});

// 4. Resilient Save Itinerary (Cloud vs Local Fallback)
router.post('/save', async (req, res) => {
    try {
        const { userId, itineraryData } = req.body;
        if (!userId || !itineraryData) {
            return res.status(400).json({ error: 'Missing userId or itineraryData' });
        }

        const result = await storageService.saveItinerary(userId, itineraryData);
        res.status(200).json(result);
    } catch (error) {
        console.error('--- STORAGE SAVE ERROR ---');
        console.error('Message:', error.message);
        res.status(500).json({ 
            error: 'Failed to save itinerary', 
            details: error.message 
        });
    }
});

// 5. Quick Budget Classification (Proportional/AI Split)
router.post('/classify', async (req, res) => {
    try {
        const { destinations, budget, daysPerCity } = req.body;
        if (!destinations || !budget || !daysPerCity) {
            return res.status(400).json({ error: 'Missing required parameters: destinations, budget, or daysPerCity' });
        }
        
        // classifyBudget NEVER throws — it always returns heuristic on any AI failure
        const classification = await geminiService.classifyBudget(destinations, budget, daysPerCity);
        res.status(200).json(classification);
    } catch (error) {
        // This catch is a safety net only; classifyBudget itself handles its errors gracefully
        console.error('Error classifying budget:', error);
        res.status(200).json({});
    }
});

// 6. Currency Suggestion (Gemini + Local Rate)
router.get('/currency-suggestion', async (req, res) => {
    try {
        const { destination } = req.query;
        console.log(`[GET] /currency-suggestion destination="${destination}"`);
        if (!destination) return res.status(400).json({ error: 'Missing destination' });
        
        const info = currencyService.getCurrencyInfo(destination);
        // Get live rate for the suggested currency
        const apiKey = process.env.EXCHANGERATE_API_KEY;
        let rate = 1;
        if (apiKey) {
            const response = await require('axios').get(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`);
            rate = response.data.conversion_rates[info.code] || 1;
        }
        
        res.status(200).json({ currency: info.code, symbol: info.symbol, rate });
    } catch (error) {
        console.error('Currency suggestion error:', error);
        res.status(500).json({ error: 'Failed to get currency suggestion' });
    }
});

// 6. List Saved Trips (Cloud + Local Merge)
router.get('/list', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        const trips = await storageService.listItineraries(userId);
        res.status(200).json({ trips });
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: 'Failed to fetch trips: ' + (error.message || 'Unknown error') });
    }
});

module.exports = router;
