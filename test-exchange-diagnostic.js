const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const apiKey = process.env.EXCHANGERATE_API_KEY;
console.log("Using API Key:", apiKey);

async function testExchange() {
    try {
        const response = await axios.get(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`);
        console.log("Status:", response.status);
        console.log("Rates (top 5):", Object.entries(response.data.conversion_rates).slice(0, 5));
    } catch (error) {
        console.error("Exchange Error:", error.response ? error.response.data : error.message);
    }
}

testExchange();
