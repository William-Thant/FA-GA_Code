/**
 * Currency Exchange Service
 * Handles currency conversion and supported currencies for each payment provider
 */

const fetch = require('node-fetch');
require('dotenv').config();

// Supported currencies by each provider
const SUPPORTED_CURRENCIES = {
  paypal: [
    'AUD', 'BRL', 'CAD', 'CNY', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF',
    'IDR', 'ILS', 'INR', 'JPY', 'MYR', 'MXN', 'NZD', 'NOK', 'PHP',
    'PLN', 'GBP', 'RUB', 'SGD', 'SEK', 'CHF', 'TWD', 'THB', 'TRY',
    'USD', 'VND', 'ZAR'
  ],
  stripe: [
    'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AZN',
    'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB',
    'BRL', 'BSD', 'BWP', 'BZD', 'CAD', 'CDF', 'CHE', 'CHF', 'CLP',
    'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP',
    'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL',
    'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK',
    'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD',
    'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KRW', 'KWD', 'KYD',
    'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL',
    'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK',
    'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
    'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
    'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK',
    'SGD', 'SHP', 'SLL', 'SOS', 'SRD', 'STN', 'SYP', 'SZL', 'THB',
    'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH',
    'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF',
    'XCD', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL'
  ],
  nets: ['SGD', 'MYR', 'IDR', 'PHP', 'THB', 'VND'] // NETS primarily supports SGD and some ASEAN currencies
};

// Cache for exchange rates (in-memory, updates every hour)
let exchangeRateCache = {
  rates: {},
  lastUpdate: 0,
  updateInterval: 3600000 // 1 hour in milliseconds
};

/**
 * Get current exchange rates from OpenExchangeRates API
 * Falls back to simple rate multipliers if API unavailable
 */
async function getExchangeRates(baseCurrency = 'SGD') {
  const now = Date.now();
  
  // Return cached rates if available and not expired
  if (
    exchangeRateCache.rates[baseCurrency] &&
    (now - exchangeRateCache.lastUpdate) < exchangeRateCache.updateInterval
  ) {
    return exchangeRateCache.rates[baseCurrency];
  }

  // Try to fetch from API if key is available
  if (process.env.OPENEXCHANGERATES_API_KEY) {
    try {
      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${process.env.OPENEXCHANGERATES_API_KEY}&base=${baseCurrency}`
      );
      const data = await response.json();
      
      if (data.rates) {
        exchangeRateCache.rates[baseCurrency] = data.rates;
        exchangeRateCache.lastUpdate = now;
        return data.rates;
      }
    } catch (error) {
      console.warn('Failed to fetch exchange rates from API:', error.message);
    }
  }

  // Fallback: Use hardcoded approximate rates (SGD as base)
  // These are approximate and should be updated periodically
  const fallbackRates = {
    'SGD': 1.0,
    'USD': 0.74,
    'EUR': 0.68,
    'GBP': 0.93,
    'JPY': 107.50,
    'AUD': 1.09,
    'CAD': 1.00,
    'CHF': 0.80,
    'CNY': 5.35,
    'INR': 61.50,
    'MYR': 3.14,
    'IDR': 10800,
    'PHP': 41.50,
    'THB': 25.50,
    'VND': 17200,
    'HKD': 5.79,
    'KRW': 913,
    'TWD': 21.50,
    'NZD': 1.17,
    'SEK': 7.45,
    'NOK': 7.60,
    'DKK': 5.10,
    'BRL': 3.78,
    'ZAR': 13.50,
    'RUB': 54.50,
    'TRY': 6.35,
    'INR': 61.50,
    'AED': 2.72,
    'SAR': 2.77,
    'MXN': 14.80,
    'CLP': 600
  };

  exchangeRateCache.rates[baseCurrency] = fallbackRates;
  exchangeRateCache.lastUpdate = now;
  
  return fallbackRates;
}

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code (e.g., 'USD')
 * @param {string} toCurrency - Target currency code (e.g., 'SGD')
 * @returns {Promise<number>} - Converted amount rounded to 2 decimals
 */
async function convertCurrency(amount, fromCurrency = 'SGD', toCurrency = 'SGD') {
  if (!amount || amount <= 0) {
    return 0;
  }

  if (fromCurrency === toCurrency) {
    return parseFloat(amount).toFixed(2);
  }

  try {
    // Get rates with SGD as base
    const rates = await getExchangeRates('SGD');
    
    // Convert from source currency to SGD
    const amountInSGD = amount / (rates[fromCurrency] || 1);
    
    // Convert from SGD to target currency
    const convertedAmount = amountInSGD * (rates[toCurrency] || 1);
    
    return parseFloat(convertedAmount).toFixed(2);
  } catch (error) {
    console.error('Currency conversion error:', error);
    throw new Error(`Failed to convert ${fromCurrency} to ${toCurrency}`);
  }
}

/**
 * Check if a currency is supported by a payment provider
 * @param {string} provider - Payment provider ('paypal', 'stripe', 'nets')
 * @param {string} currency - Currency code
 * @returns {boolean}
 */
function isCurrencySupported(provider, currency) {
  const provider_lower = provider.toLowerCase();
  const currency_upper = currency.toUpperCase();
  
  if (!SUPPORTED_CURRENCIES[provider_lower]) {
    return false;
  }
  
  return SUPPORTED_CURRENCIES[provider_lower].includes(currency_upper);
}

/**
 * Get all supported currencies for a provider
 * @param {string} provider - Payment provider ('paypal', 'stripe', 'nets')
 * @returns {array}
 */
function getSupportedCurrencies(provider) {
  return SUPPORTED_CURRENCIES[provider.toLowerCase()] || [];
}

/**
 * Validate and normalize currency code
 * @param {string} currency - Currency code
 * @returns {string} - Uppercase currency code or default 'SGD'
 */
function normalizeCurrency(currency) {
  if (!currency || typeof currency !== 'string') {
    return 'SGD';
  }
  
  const normalized = currency.toUpperCase();
  
  // Check if it's a valid 3-letter code
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  
  return 'SGD';
}

module.exports = {
  getExchangeRates,
  convertCurrency,
  isCurrencySupported,
  getSupportedCurrencies,
  normalizeCurrency,
  SUPPORTED_CURRENCIES
};
