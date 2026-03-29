const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const currencyService = require('../services/currencyService');
const weatherService = require('../services/weatherService');
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
        const { destinations, budget, days, currentLocation, isInternational } = req.body;
        
        let targetBudget = budget;
        let currencyInfo = { currency: 'INR', rate: 1 };

        if (isInternational) {
            const conversion = await currencyService.convertToLocalCurrency(budget, destinations[0]);
            targetBudget = conversion.amount;
            currencyInfo = { currency: conversion.currency, symbol: conversion.symbol, rate: conversion.rate };
        }

        const analysis = await geminiService.analyzeBudgetFeasibility(destinations, targetBudget, days, currentLocation, currencyInfo.currency);
        
        // Append currency context for the frontend
        res.status(200).json({ ...analysis, currencyContext: currencyInfo });
    } catch (error) {
        console.error('--- ERROR IN ANALYSIS ---');
        console.error(error.stack || error);
        res.status(500).json({ error: 'Failed to analyze budget: ' + (error.message || 'Unknown server error') });
    }
});

// 2. Generate Itinerary (Weather Aware)
router.post('/plan', async (req, res) => {
    try {
        const { destinations, budget, days, currentLocation, allocation } = req.body;
        
        // Fetch weather context before generating
        const weatherData = await weatherService.getDestinationsWeather(destinations);
        
        const itinerary = await geminiService.generateItinerary(destinations, budget, days, currentLocation, allocation, weatherData);
        res.status(200).json({ ...itinerary, weatherContext: weatherData });
    } catch (error) {
        console.error('Error generating plan:', error);
        res.status(500).json({ error: 'Failed to generate itinerary' });
    }
});


// 3. Dynamic Rescheduling
router.post('/reschedule', async (req, res) => {
    try {
        const { remainingItinerary, missedActivity, remainingBudget, currentLocation } = req.body;
        const updatedItinerary = await geminiService.rescheduleItinerary(remainingItinerary, missedActivity, remainingBudget, currentLocation);
        res.status(200).json({ days: updatedItinerary });
    } catch (error) {
        console.error('Error rescheduling:', error);
        res.status(500).json({ error: 'Failed to reschedule' });
    }
});

// 4. Save Itinerary to Firebase
router.post('/save', async (req, res) => {
    try {
        const { userId, itineraryData } = req.body;
        if (!userId || !itineraryData) {
            return res.status(400).json({ error: 'Missing userId or itineraryData' });
        }
        
        const docRef = await db.collection('itineraries').add({
            userId,
            itineraryData,
            createdAt: new Date().toISOString()
        });
        
        res.status(200).json({ success: true, id: docRef.id });
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        res.status(500).json({ error: 'Failed to save itinerary' });
    }
});

// 5. Currency Suggestion (Gemini + Local Rate)
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

// 6. List Saved Trips
router.get('/list', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        const snapshot = await db.collection('itineraries')
            .where('userId', '==', userId)
            .get();
        
        const trips = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            trips.push({
                id: doc.id,
                ...data.itineraryData,
                savedAt: data.createdAt
            });
        });

        // Sort descending by date
        trips.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        
        res.status(200).json({ trips });
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: 'Failed to fetch trips: ' + (error.message || 'Unknown error') });
    }
});

module.exports = router;
