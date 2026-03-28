const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Fetches basic weather data for the destinations to inject into the Gemini prompt.
 */
const getDestinationsWeather = async (destinations) => {
    const weatherData = {};
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
        console.warn('No OpenWeather API Key found. Returning empty weather data.');
        return weatherData;
    }

    try {
        for (const city of destinations) {
            // Using the current weather endpoint for simplicity in the prompt context
            const response = await axios.get(
                `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
            );
            
            weatherData[city] = {
                temp: response.data.main.temp,
                condition: response.data.weather[0].description
            };
        }
        return weatherData;
    } catch (error) {
        console.error('Error fetching weather:', error.message);
        return weatherData; // Return whatever we managed to fetch (or empty)
    }
};

module.exports = { getDestinationsWeather };
