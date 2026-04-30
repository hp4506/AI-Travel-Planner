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
    'munich': { code: 'EUR', symbol: '€' },
    'frankfurt': { code: 'EUR', symbol: '€' },
    'rome': { code: 'EUR', symbol: '€' },
    'milan': { code: 'EUR', symbol: '€' },
    'venice': { code: 'EUR', symbol: '€' },
    'madrid': { code: 'EUR', symbol: '€' },
    'barcelona': { code: 'EUR', symbol: '€' },
    'amsterdam': { code: 'EUR', symbol: '€' },
    'athens': { code: 'EUR', symbol: '€' },
    'lisbon': { code: 'EUR', symbol: '€' },
    'vienna': { code: 'EUR', symbol: '€' },
    'prague': { code: 'CZK', symbol: 'Kč' },
    'budapest': { code: 'HUF', symbol: 'Ft' },
    'warsaw': { code: 'PLN', symbol: 'zł' },
    'stockholm': { code: 'SEK', symbol: 'kr' },
    'oslo': { code: 'NOK', symbol: 'kr' },
    'london': { code: 'GBP', symbol: '£' },
    'manchester': { code: 'GBP', symbol: '£' },
    'edinburgh': { code: 'GBP', symbol: '£' },
    'zurich': { code: 'CHF', symbol: 'CHF' },
    'geneva': { code: 'CHF', symbol: 'CHF' },
    'switzerland': { code: 'CHF', symbol: 'CHF' },

    // Middle East
    'dubai': { code: 'AED', symbol: 'AED' },
    'abu dhabi': { code: 'AED', symbol: 'AED' },
    'abudhabi': { code: 'AED', symbol: 'AED' },
    'qatar': { code: 'QAR', symbol: 'QAR' },
    'doha': { code: 'QAR', symbol: 'QAR' },
    'riyadh': { code: 'SAR', symbol: 'SAR' },
    'saudi': { code: 'SAR', symbol: 'SAR' },
    'istanbul': { code: 'TRY', symbol: '₺' },
    'ankara': { code: 'TRY', symbol: '₺' },
    'turkey': { code: 'TRY', symbol: '₺' },

    // Americas
    'new york': { code: 'USD', symbol: '$' },
    'los angeles': { code: 'USD', symbol: '$' },
    'chicago': { code: 'USD', symbol: '$' },
    'miami': { code: 'USD', symbol: '$' },
    'las vegas': { code: 'USD', symbol: '$' },
    'san francisco': { code: 'USD', symbol: '$' },
    'toronto': { code: 'CAD', symbol: 'C$' },
    'vancouver': { code: 'CAD', symbol: 'C$' },
    'montreal': { code: 'CAD', symbol: 'C$' },
    'mexico city': { code: 'MXN', symbol: 'MX$' },
    'cancun': { code: 'MXN', symbol: 'MX$' },
    'mexico': { code: 'MXN', symbol: 'MX$' },
    'rio': { code: 'BRL', symbol: 'R$' },
    'sao paulo': { code: 'BRL', symbol: 'R$' },
    'brazil': { code: 'BRL', symbol: 'R$' },
    'buenos aires': { code: 'ARS', symbol: 'AR$' },

    // Southeast Asia
    'tokyo': { code: 'JPY', symbol: '¥' },
    'osaka': { code: 'JPY', symbol: '¥' },
    'kyoto': { code: 'JPY', symbol: '¥' },
    'japan': { code: 'JPY', symbol: '¥' },
    'singapore': { code: 'SGD', symbol: 'S$' },
    'bangkok': { code: 'THB', symbol: '฿' },
    'phuket': { code: 'THB', symbol: '฿' },
    'chiang mai': { code: 'THB', symbol: '฿' },
    'thailand': { code: 'THB', symbol: '฿' },
    'bali': { code: 'IDR', symbol: 'Rp' },
    'jakarta': { code: 'IDR', symbol: 'Rp' },
    'yogyakarta': { code: 'IDR', symbol: 'Rp' },
    'indonesia': { code: 'IDR', symbol: 'Rp' },
    'kuala lumpur': { code: 'MYR', symbol: 'RM' },
    'penang': { code: 'MYR', symbol: 'RM' },
    'malaysia': { code: 'MYR', symbol: 'RM' },
    'manila': { code: 'PHP', symbol: '₱' },
    'cebu': { code: 'PHP', symbol: '₱' },
    'philippines': { code: 'PHP', symbol: '₱' },
    'seoul': { code: 'KRW', symbol: '₩' },
    'busan': { code: 'KRW', symbol: '₩' },
    'korea': { code: 'KRW', symbol: '₩' },
    'hong kong': { code: 'HKD', symbol: 'HK$' },
    'taipei': { code: 'TWD', symbol: 'NT$' },
    'taiwan': { code: 'TWD', symbol: 'NT$' },
    'beijing': { code: 'CNY', symbol: '¥' },
    'shanghai': { code: 'CNY', symbol: '¥' },
    'china': { code: 'CNY', symbol: '¥' },

    // Vietnam  ← THE FIX
    'vietnam': { code: 'VND', symbol: '₫' },
    'hanoi': { code: 'VND', symbol: '₫' },
    'ho chi minh': { code: 'VND', symbol: '₫' },
    'ho chi minh city': { code: 'VND', symbol: '₫' },
    'hcmc': { code: 'VND', symbol: '₫' },
    'da nang': { code: 'VND', symbol: '₫' },
    'hoi an': { code: 'VND', symbol: '₫' },
    'ha long': { code: 'VND', symbol: '₫' },

    // South Asia
    'colombo': { code: 'LKR', symbol: 'Rs' },
    'kandy': { code: 'LKR', symbol: 'Rs' },
    'sri lanka': { code: 'LKR', symbol: 'Rs' },
    'kathmandu': { code: 'NPR', symbol: 'रू' },
    'pokhara': { code: 'NPR', symbol: 'रू' },
    'nepal': { code: 'NPR', symbol: 'रू' },
    'dhaka': { code: 'BDT', symbol: '৳' },
    'bangladesh': { code: 'BDT', symbol: '৳' },

    // Africa
    'cairo': { code: 'EGP', symbol: 'E£' },
    'egypt': { code: 'EGP', symbol: 'E£' },
    'cape town': { code: 'ZAR', symbol: 'R' },
    'capetown': { code: 'ZAR', symbol: 'R' },
    'johannesburg': { code: 'ZAR', symbol: 'R' },
    'south africa': { code: 'ZAR', symbol: 'R' },
    'nairobi': { code: 'KES', symbol: 'KSh' },
    'kenya': { code: 'KES', symbol: 'KSh' },
    'morocco': { code: 'MAD', symbol: 'MAD' },
    'marrakech': { code: 'MAD', symbol: 'MAD' },

    // Oceania
    'sydney': { code: 'AUD', symbol: 'A$' },
    'melbourne': { code: 'AUD', symbol: 'A$' },
    'brisbane': { code: 'AUD', symbol: 'A$' },
    'australia': { code: 'AUD', symbol: 'A$' },
    'auckland': { code: 'NZD', symbol: 'NZ$' },
    'new zealand': { code: 'NZD', symbol: 'NZ$' },

    // India (Default INR)
    'goa': { code: 'INR', symbol: '₹' },
    'mumbai': { code: 'INR', symbol: '₹' },
    'delhi': { code: 'INR', symbol: '₹' },
    'new delhi': { code: 'INR', symbol: '₹' },
    'bangalore': { code: 'INR', symbol: '₹' },
    'bengaluru': { code: 'INR', symbol: '₹' },
    'chennai': { code: 'INR', symbol: '₹' },
    'kolkata': { code: 'INR', symbol: '₹' },
    'hyderabad': { code: 'INR', symbol: '₹' },
    'pune': { code: 'INR', symbol: '₹' },
    'jaipur': { code: 'INR', symbol: '₹' },
    'rishikesh': { code: 'INR', symbol: '₹' },
    'agra': { code: 'INR', symbol: '₹' },
    'kerala': { code: 'INR', symbol: '₹' },
    'daman': { code: 'INR', symbol: '₹' },
    'diu': { code: 'INR', symbol: '₹' },
    'silvassa': { code: 'INR', symbol: '₹' },
    'pondicherry': { code: 'INR', symbol: '₹' },
    'puducherry': { code: 'INR', symbol: '₹' },
    'port blair': { code: 'INR', symbol: '₹' },
    'leh': { code: 'INR', symbol: '₹' },
    'ladakh': { code: 'INR', symbol: '₹' },
    'srinagar': { code: 'INR', symbol: '₹' },
    'manali': { code: 'INR', symbol: '₹' },
    'shimla': { code: 'INR', symbol: '₹' },
    'india': { code: 'INR', symbol: '₹' },
};

const getCurrencyInfo = (destination) => {
    const dest = destination.toLowerCase().trim();
    // Check direct matches
    if (currencyMapping[dest]) return currencyMapping[dest];
    
    // Check if any key is contained in the destination string
    for (const key in currencyMapping) {
        if (dest.includes(key)) return currencyMapping[key];
    }
    
    // Fallback based on common country/region names if city not found
    if (dest.includes('france') || dest.includes('germany') || dest.includes('italy') ||
        dest.includes('spain') || dest.includes('netherlands') || dest.includes('portugal') ||
        dest.includes('greece') || dest.includes('austria') || dest.includes('belgium'))
        return { code: 'EUR', symbol: '€' };
    if (dest.includes('usa') || dest.includes('america') || dest.includes('united states'))
        return { code: 'USD', symbol: '$' };
    if (dest.includes('uk') || dest.includes('united kingdom') || dest.includes('england') || dest.includes('scotland'))
        return { code: 'GBP', symbol: '£' };
    if (dest.includes('canada'))       return { code: 'CAD', symbol: 'C$' };
    if (dest.includes('japan'))        return { code: 'JPY', symbol: '¥' };
    if (dest.includes('vietnam') || dest.includes('viet nam'))
                                       return { code: 'VND', symbol: '₫' };
    if (dest.includes('thailand'))     return { code: 'THB', symbol: '฿' };
    if (dest.includes('indonesia'))    return { code: 'IDR', symbol: 'Rp' };
    if (dest.includes('malaysia'))     return { code: 'MYR', symbol: 'RM' };
    if (dest.includes('philippines'))  return { code: 'PHP', symbol: '₱' };
    if (dest.includes('korea'))        return { code: 'KRW', symbol: '₩' };
    if (dest.includes('china'))        return { code: 'CNY', symbol: '¥' };
    if (dest.includes('taiwan'))       return { code: 'TWD', symbol: 'NT$' };
    if (dest.includes('sri lanka'))    return { code: 'LKR', symbol: 'Rs' };
    if (dest.includes('nepal'))        return { code: 'NPR', symbol: 'रू' };
    if (dest.includes('bangladesh'))   return { code: 'BDT', symbol: '৳' };
    if (dest.includes('turkey'))       return { code: 'TRY', symbol: '₺' };
    if (dest.includes('south africa')) return { code: 'ZAR', symbol: 'R' };
    if (dest.includes('egypt'))        return { code: 'EGP', symbol: 'E£' };
    if (dest.includes('kenya'))        return { code: 'KES', symbol: 'KSh' };
    if (dest.includes('morocco'))      return { code: 'MAD', symbol: 'MAD' };
    if (dest.includes('mexico'))       return { code: 'MXN', symbol: 'MX$' };
    if (dest.includes('brazil'))       return { code: 'BRL', symbol: 'R$' };
    if (dest.includes('australia'))    return { code: 'AUD', symbol: 'A$' };
    if (dest.includes('new zealand'))  return { code: 'NZD', symbol: 'NZ$' };
    if (dest.includes('india'))        return { code: 'INR', symbol: '₹' };

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

module.exports = { convertToLocalCurrency, getCurrencyInfo };

