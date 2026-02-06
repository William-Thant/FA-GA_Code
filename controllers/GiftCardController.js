const GiftCard = require('../models/GiftCard');
const emailService = require('../utils/emailService');

class GiftCardController {
  /**
   * Show gift card purchase page
   */
  static showPurchasePage(req, res) {
    res.render('giftcard/purchase', {
      user: req.session.user,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      }
    });
  }

  /**
   * Process gift card purchase
   */
  static purchaseGiftCard(req, res) {
    const { amount, recipientEmail, recipientName, message, sendEmail } = req.body;
    
    if (!amount || amount < 10) {
      req.flash('error', 'Minimum gift card amount is $10');
      return res.redirect('/giftcards/purchase');
    }

    if (amount > 100000) {
      req.flash('error', 'Maximum gift card amount is $100,000');
      return res.redirect('/giftcards/purchase');
    }
    
    // Store gift card details in session for payment processing
    req.session.giftCardPurchase = {
      amount: parseFloat(amount),
      recipientEmail: sendEmail === 'yes' ? recipientEmail : null,
      recipientName: sendEmail === 'yes' ? recipientName : null,
      message: sendEmail === 'yes' ? message : null,
      sendEmail: sendEmail === 'yes'
    };
    
    // Redirect to payment page
    req.flash('info', 'Please select a payment method to complete your gift card purchase');
    res.redirect('/giftcards/payment');
  }

  /**
   * Show gift card payment page
   */
  static showPaymentPage(req, res) {
    if (!req.session.giftCardPurchase) {
      req.flash('error', 'No gift card purchase in progress');
      return res.redirect('/giftcards/purchase');
    }

    const giftCardAmount = req.session.giftCardPurchase.amount;
    
    // Get wallet balance
    const Wallet = require('../models/Wallet');
    Wallet.getBalance(req.session.user.userId, (err, walletBalance) => {
      if (err) {
        console.error('Error fetching wallet balance:', err);
        walletBalance = 0;
      }
      
      res.render('giftcard/payment', {
        amount: giftCardAmount,
        walletBalance: walletBalance || 0,
        user: req.session.user,
        giftCardDetails: req.session.giftCardPurchase,
        process: process,
        messages: {
          error: req.flash('error'),
          success: req.flash('success'),
          info: req.flash('info')
        }
      });
    });
  }

  /**
   * Show success page after purchase
   */
  static showSuccessPage(req, res) {
    // Check for query parameters first (used by Stripe)
    let code = req.query.code;
    let amount = req.query.amount;
    
    // Fall back to flash messages (used by other payment methods)
    if (!code) {
      const flashCode = req.flash('giftCardCode');
      const flashAmount = req.flash('giftCardAmount');
      
      if (!flashCode || flashCode.length === 0) {
        return res.redirect('/giftcards/purchase');
      }
      
      code = flashCode[0];
      amount = flashAmount[0];
    }
    
    res.render('giftcard/success', {
      user: req.session.user,
      code: code,
      amount: amount,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      }
    });
  }

  /**
   * Check gift card balance
   */
  static checkBalance(req, res) {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Gift card code is required' });
    }
    
    GiftCard.getBalance(code, (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json(result);
    });
  }

  /**
   * Show balance check page
   */
  static showBalancePage(req, res) {
    res.render('giftcard/balance', {
      user: req.session.user,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      }
    });
  }

  /**
   * Show user's purchased gift cards
   */
  static showMyGiftCards(req, res) {
    GiftCard.getUserPurchased(req.session.user.userId, (err, giftCards) => {
      if (err) {
        console.error('Error fetching gift cards:', err);
        req.flash('error', 'Failed to load gift cards');
        return res.redirect('/');
      }
      
      res.render('giftcard/myGiftCards', {
        user: req.session.user,
        giftCards,
        messages: {
          error: req.flash('error'),
          success: req.flash('success')
        }
      });
    });
  }

  /**
   * Validate gift card code (AJAX endpoint for checkout)
   */
  static validateCode(req, res) {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Gift card code is required' });
    }
    
    GiftCard.validate(code, (err, giftCard) => {
      if (err) {
        return res.status(400).json({ valid: false, error: err.message });
      }
      
      res.json({
        valid: true,
        balance: parseFloat(giftCard.currentBalance),
        code: giftCard.code
      });
    });
  }

  /**
   * Finalize gift card creation after payment
   * Can be called from payment success handlers (NETS, PayPal, Stripe)
   * @param {boolean} returnJson - Whether to return JSON response (true for Stripe) or redirect (false for NETS/PayPal)
   */
  static finalizeGiftCardPurchase(req, res, paymentMethod, paymentReference, returnJson = false) {
    if (!req.session.giftCardPurchase) {
      if (returnJson) {
        return res.json({ success: false, error: 'No gift card purchase in progress' });
      }
      req.flash('error', 'No gift card purchase in progress');
      return res.redirect('/giftcards/purchase');
    }

    const userId = req.session.user.userId;
    const giftCardData = req.session.giftCardPurchase;
    
    const finalData = {
      amount: giftCardData.amount,
      purchasedBy: userId,
      recipientEmail: giftCardData.recipientEmail,
      recipientName: giftCardData.recipientName,
      message: giftCardData.message
    };

    GiftCard.create(finalData, (err, giftCard) => {
      if (err) {
        console.error('Gift card creation error after payment:', err);
        if (returnJson) {
          return res.json({ success: false, error: 'Failed to create gift card' });
        }
        req.flash('error', 'Failed to create gift card');
        return res.redirect('/giftcards/payment');
      }

      // Send email if requested
      if (giftCardData.sendEmail && giftCardData.recipientEmail) {
        const emailService = require('../utils/emailService');
        emailService.sendGiftCard(
          giftCardData.recipientEmail,
          giftCardData.recipientName,
          giftCard.code,
          giftCard.amount,
          giftCardData.message,
          req.session.user.name
        ).catch(emailErr => console.error('Gift card email error:', emailErr));
      }

      // Clear session data
      delete req.session.giftCardPurchase;
      delete req.session.giftCardNetsRef;

      // Redirect or return JSON based on payment method
      if (returnJson) {
        return res.json({
          success: true,
          redirectUrl: `/giftcards/success?code=${giftCard.code}&amount=${giftCard.amount}`
        });
      }
      
      req.flash('giftCardCode', giftCard.code);
      req.flash('giftCardAmount', giftCard.amount.toFixed(2));
      req.flash('success', 'Gift card purchased successfully!');
      res.redirect('/giftcards/success');
    });
  }
}

module.exports = GiftCardController;
