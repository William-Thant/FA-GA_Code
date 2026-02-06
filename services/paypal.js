const fetch = require('node-fetch');
require('dotenv').config();
const currencyService = require('../utils/currencyService');

const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_API = process.env.PAYPAL_API;

async function getAccessToken() {
  try {
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(PAYPAL_CLIENT + ':' + PAYPAL_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      throw new Error(`PayPal auth failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token in PayPal response');
    }
    
    return data.access_token;
  } catch (error) {
    console.error('PayPal getAccessToken error:', error);
    throw error;
  }
}

/**
 * Create an order on PayPal
 * @param {number} amount - Amount to charge
 * @param {string} currency - Currency code (default: 'SGD')
 * @param {object} options - Additional options (e.g., description, metadata)
 * @returns {Promise<object>} - PayPal order response
 */
async function createOrder(amount, currency = 'SGD', options = {}) {
  try {
    // Normalize and validate currency
    const normalizedCurrency = currencyService.normalizeCurrency(currency);
    
    // Check if currency is supported by PayPal
    if (!currencyService.isCurrencySupported('paypal', normalizedCurrency)) {
      console.warn(`Currency ${normalizedCurrency} not supported by PayPal. Using SGD as fallback.`);
      currency = 'SGD';
    } else {
      currency = normalizedCurrency;
    }
    
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: parseFloat(amount).toFixed(2)
          }
        }],
        description: options.description || 'Payment'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal API error:', errorData);
      throw new Error(`PayPal order creation failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('PayPal createOrder error:', error);
    throw error;
  }
}

async function captureOrder(orderId) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const data = await response.json();
  console.log('PayPal captureOrder response:', data);
  return data;
}

/**
 * Refund a PayPal capture
 * @param {string} captureId - The capture ID to refund
 * @param {number} amount - Optional amount to refund (in dollars)
 * @param {string} currency - Currency code (default: 'SGD')
 * @returns {Promise<object>} - Refund response
 */
async function refundCapture(captureId, amount = null, currency = 'SGD') {
  const accessToken = await getAccessToken();
  
  // Normalize currency
  const normalizedCurrency = currencyService.normalizeCurrency(currency);
  const finalCurrency = currencyService.isCurrencySupported('paypal', normalizedCurrency) 
    ? normalizedCurrency 
    : 'SGD';
  
  let body = {};
  if (amount !== null && amount !== undefined) {
    body = {
      amount: {
        currency_code: finalCurrency,
        value: parseFloat(amount).toFixed(2)
      }
    };
  }
  
  const response = await fetch(`${PAYPAL_API}/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  console.log('PayPal refund response:', data);
  return data;
}

module.exports = { createOrder, captureOrder, refundCapture };
