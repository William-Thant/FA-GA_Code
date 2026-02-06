require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const currencyService = require('../utils/currencyService');

/**
 * Create a Payment Intent for Stripe checkout
 * @param {number} amount - The amount in dollars (will be converted to cents)
 * @param {string} currency - Currency code (default: 'sgd')
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} - Payment Intent object
 */
async function createPaymentIntent(amount, currency = 'sgd', metadata = {}) {
  try {
    // Normalize and validate currency
    const normalizedCurrency = currencyService.normalizeCurrency(currency).toLowerCase();
    
    // Check if currency is supported by Stripe
    if (!currencyService.isCurrencySupported('stripe', normalizedCurrency)) {
      console.warn(`Currency ${normalizedCurrency} not supported by Stripe. Using sgd as fallback.`);
      currency = 'sgd';
    } else {
      currency = normalizedCurrency;
    }
    
    // Convert amount to cents (Stripe expects smallest currency unit)
    // Some currencies don't use cents (e.g., JPY), handle accordingly
    const amountInSmallestUnit = Math.round(parseFloat(amount) * 100);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency: currency,
      metadata: metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      currency: paymentIntent.currency,
      amount: paymentIntent.amount
    };
  } catch (error) {
    console.error('Error creating Stripe Payment Intent:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Retrieve a Payment Intent by ID
 * @param {string} paymentIntentId - The Payment Intent ID
 * @returns {Promise<object>} - Payment Intent object
 */
async function retrievePaymentIntent(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      success: true,
      paymentIntent: paymentIntent
    };
  } catch (error) {
    console.error('Error retrieving Stripe Payment Intent:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a Checkout Session (alternative method)
 * @param {array} lineItems - Array of line items for the checkout
 * @param {string} successUrl - URL to redirect on success
 * @param {string} cancelUrl - URL to redirect on cancel
 * @returns {Promise<object>} - Checkout Session object
 */
async function createCheckoutSession(lineItems, successUrl, cancelUrl) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    
    return {
      success: true,
      sessionId: session.id,
      url: session.url
    };
  } catch (error) {
    console.error('Error creating Stripe Checkout Session:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a refund for a payment
 * @param {string} paymentIntentId - The Payment Intent ID to refund
 * @param {number} amount - Optional amount to refund (in dollars). If not provided, refunds full amount
 * @param {string} currency - Currency code for reference
 * @returns {Promise<object>} - Refund result
 */
async function createRefund(paymentIntentId, amount = null, currency = 'sgd') {
  try {
    // Normalize currency
    const normalizedCurrency = currencyService.normalizeCurrency(currency).toLowerCase();
    
    const refundData = { 
      payment_intent: paymentIntentId 
    };
    
    // If amount specified, convert to smallest unit for refund
    if (amount !== null && amount !== undefined) {
      refundData.amount = Math.round(parseFloat(amount) * 100);
    }
    
    const refund = await stripe.refunds.create(refundData);
    
    return {
      success: true,
      refund: refund,
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount / 100, // Convert back to dollars
      currency: normalizedCurrency
    };
  } catch (error) {
    console.error('Error creating Stripe refund:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get refund status
 * @param {string} refundId - The Refund ID
 * @returns {Promise<object>} - Refund status
 */
async function getRefundStatus(refundId) {
  try {
    const refund = await stripe.refunds.retrieve(refundId);
    return {
      success: true,
      status: refund.status,
      amount: refund.amount / 100,
      refund: refund
    };
  } catch (error) {
    console.error('Error retrieving Stripe refund:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createPaymentIntent,
  retrievePaymentIntent,
  createCheckoutSession,
  createRefund,
  getRefundStatus
};
