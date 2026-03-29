const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// Mapping of popular destinations to their currency codes
const currencyMapping = {
    // Europe
    'paris': { code: 'EUR', symbol: '€' },
    'lyon': { code: 'EUR', symbol: '€' },
    'nice': { code: 'EUR', symbol: '€' },
    'berlin': { code: 'EUR', symbol: '€' },
    'rome': { code: 'EUR', symbol: '€' },
    'madrid': { code: 'EUR', symbol: '€' },
    'amsterdam': { code: 'EUR', symbol: '€' },
    'london': { code: 'GBP', symbol: '£' },
    'manchester': { code: 'GBP', symbol: '£' },
    'switzerland': { code: 'CHF', symbol: 'CHf' },
    'zurich': { code: 'CHF', symbol: 'CHf' },

    // Middle East
    'dubai': { code: 'AED', symbol: 'د.إ' },
    'abudhabi': { code: 'AED', symbol: 'د.إ' },
    'qatar': { code: 'QAR', symbol: 'ر.ق' },
    'doha': { code: 'QAR', symbol: 'ر.ق' },

    // Americas
    'new york': { code: 'USD', symbol: '$' },
    'los angeles': { code: 'USD', symbol: '$' },
    'chicago': { code: 'USD', symbol: '$' },
    'toronto': { code: 'CAD', symbol: 'C$' },
    'vancouver': { code: 'CAD', symbol: 'C$' },

    // Asia
    'tokyo': { code: 'JPY', symbol: '¥' },
    'osaka': { code: 'JPY', symbol: '¥' },
    'singapore': { code: 'SGD', symbol: 'S$' },
    'bangkok': { code: 'THB', symbol: '฿' },
    'phuket': { code: 'THB', symbol: '฿' },
    'bali': { code: 'IDR', symbol: 'Rp' },
    'jakarta': { code: 'IDR', symbol: 'Rp' },
    'seoul': { code: 'KRW', symbol: '₩' },
    'hong kong': { code: 'HKD', symbol: 'HK$' },
    'colombo': { code: 'LKR', symbol: 'Rs' },

    // Oceania
    'sydney': { code: 'AUD', symbol: 'A$' },
    'melbourne': { code: 'AUD', symbol: 'A$' },
    'auckland': { code: 'NZD', symbol: 'NZ$' },

    // India (Default)
    'goa': { code: 'INR', symbol: '₹' },
    'mumbai': { code: 'INR', symbol: '₹' },
    'delhi': { code: 'INR', symbol: '₹' },
    'bangalore': { code: 'INR', symbol: '₹' },
    'chennai': { code: 'INR', symbol: '₹' },
    'kolkata': { code: 'INR', symbol: '₹' }
};

const getCurrencyInfo = (destination) => {
    const dest = destination.toLowerCase().trim();
    // Check direct matches
    if (currencyMapping[dest]) return currencyMapping[dest];
    
    // Check if any key is contained in the destination string
    for (const key in currencyMapping) {
        if (dest.includes(key)) return currencyMapping[key];
    }
    
    // Fallback based on common country names if city not found
    if (dest.includes('france') || dest.includes('germany') || dest.includes('italy') || dest.includes('spain') || dest.includes('netherlands')) return { code: 'EUR', symbol: '€' };
    if (dest.includes('usa') || dest.includes('america') || dest.includes('united states')) return { code: 'USD', symbol: '$' };
    if (dest.includes('uk') || dest.includes('united kingdom')) return { code: 'GBP', symbol: '£' };
    if (dest.includes('canada')) return { code: 'CAD', symbol: 'C$' };
    if (dest.includes('japan')) return { code: 'JPY', symbol: '¥' };
    if (dest.includes('thailand')) return { code: 'THB', symbol: '฿' };
    if (dest.includes('indonesia')) return { code: 'IDR', symbol: 'Rp' };
    if (dest.includes('australia')) return { code: 'AUD', symbol: 'A$' };
    if (dest.includes('india')) return { code: 'INR', symbol: '₹' };

    return { code: 'USD', symbol: '$' }; // Global fallback
};

const convertToLocalCurrency = async (amountINR, destination) => {
    const apiKey = process.env.EXCHANGERATE_API_KEY;
    if (!apiKey) {
        console.warn('No ExchangeRate API Key found. Returning original INR amount.');
        return amountINR;
    }
    
    try {
        const info = getCurrencyInfo(destination);
        const targetCurrency = info.code;
        
        const response = await axios.get(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`);
        const rate = response.data.conversion_rates[targetCurrency];
        
        if (rate) {
            const converted = amountINR * rate;
            return {
                amount: converted,
                currency: targetCurrency,
                symbol: info.symbol,
                rate: rate
            };
        }
        return { amount: amountINR, currency: 'INR', symbol: '₹', rate: 1 };
    } catch (error) {
        console.error('Currency conversion error:', error.message);
        return { amount: amountINR, currency: 'INR', rate: 1 };
    }
};

const getMultipleCurrencies = async (destinations) => {
    const multiContext = {};
    for (const dest of destinations) {
        const info = getCurrencyInfo(dest);
        const apiKey = process.env.EXCHANGERATE_API_KEY;
        let rate = 1;
        
        if (apiKey && info.code !== 'INR') {
            try {
                const response = await axios.get(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`);
                const fetchedRate = response.data.conversion_rates[info.code];
                if (fetchedRate) rate = fetchedRate;
            } catch (err) { }
        }
        
        multiContext[dest] = {
            currency: info.code,
            symbol: info.symbol,
            rate: rate
        };
    }
    return multiContext;
};

module.exports = { convertToLocalCurrency, getCurrencyInfo, getMultipleCurrencies };
