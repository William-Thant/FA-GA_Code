const nodemailer = require('nodemailer');

// Create a transporter using environment variables or a test account
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false,
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASSWORD || ''
    }
});

/**
 * Send an e-receipt to the customer
 * @param {string} email - Customer email address
 * @param {string} orderId - Order ID
 * @param {Array} items - Array of cart items {productName, quantity, price}
 * @param {number} subtotal - Subtotal amount
 * @param {number} tax - Tax amount
 * @param {number} total - Total amount
 */
async function sendEReceipt(email, orderId, items, subtotal, tax, total) {
    try {
        if (!process.env.EMAIL_USER) {
            console.warn('Email service not configured. Skipping receipt send.');
            return { success: false, message: 'Email service not configured' };
        }

        // Build HTML email body
        let itemsHtml = items.map(item => `
            <tr>
                <td style="padding: 15px 10px; border-bottom: 2px solid #2a2a2a; color: #ffffff;">${item.productName}</td>
                <td style="padding: 15px 10px; border-bottom: 2px solid #2a2a2a; text-align: center; color: #00d4ff; font-weight: 700;">${item.quantity}</td>
                <td style="padding: 15px 10px; border-bottom: 2px solid #2a2a2a; text-align: right; color: #ffd700;">$${item.price.toFixed(2)}</td>
                <td style="padding: 15px 10px; border-bottom: 2px solid #2a2a2a; text-align: right; color: #ffd700; font-weight: 700;">$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Arial', sans-serif; color: #ffffff; background-color: #0a0a0a; margin: 0; padding: 0; }
                    .container { max-width: 650px; margin: 30px auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 3px solid #ff3333; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 40px rgba(255, 51, 51, 0.3); }
                    .header { background: linear-gradient(135deg, #ff3333 0%, #cc0000 100%); color: white; padding: 40px 30px; text-align: center; position: relative; }
                    .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(45deg, transparent 48%, rgba(255, 255, 255, 0.05) 49%, rgba(255, 255, 255, 0.05) 51%, transparent 52%), linear-gradient(-45deg, transparent 48%, rgba(255, 255, 255, 0.05) 49%, rgba(255, 255, 255, 0.05) 51%, transparent 52%); background-size: 20px 20px; }
                    .header h1 { margin: 0; font-size: 2.2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; position: relative; z-index: 1; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); }
                    .header .tagline { font-size: 1rem; margin-top: 10px; color: #ffd700; font-weight: 600; position: relative; z-index: 1; text-transform: uppercase; letter-spacing: 2px; }
                    .content { background: #0a0a0a; padding: 30px; }
                    .greeting { font-size: 1.1rem; color: #00d4ff; margin-bottom: 20px; font-weight: 600; }
                    .order-info { background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%); border: 2px solid #2a2a2a; border-radius: 10px; padding: 20px; margin: 20px 0; }
                    .order-id { font-size: 1.4rem; font-weight: 900; color: #ff3333; margin: 10px 0; text-transform: uppercase; letter-spacing: 2px; }
                    .order-date { font-size: 0.95rem; color: #888888; font-weight: 600; }
                    .section-title { font-size: 1.3rem; font-weight: 900; color: #ffffff; margin: 30px 0 15px 0; text-transform: uppercase; letter-spacing: 2px; border-bottom: 3px solid #ff3333; padding-bottom: 10px; }
                    table { width: 100%; margin: 20px 0; border-collapse: collapse; background: #0a0a0a; border: 2px solid #2a2a2a; border-radius: 10px; overflow: hidden; }
                    th { background: linear-gradient(135deg, #ff3333 0%, #cc0000 100%); padding: 15px 10px; text-align: left; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 1px; font-size: 0.9rem; border-bottom: none; }
                    th:nth-child(2) { text-align: center; }
                    th:nth-child(3), th:nth-child(4) { text-align: right; }
                    .summary { margin-top: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%); border: 2px solid #2a2a2a; border-radius: 10px; padding: 20px; }
                    .summary-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 1rem; color: #ffffff; border-bottom: 1px solid #2a2a2a; }
                    .summary-row:last-child { border-bottom: none; }
                    .summary-row span:first-child { font-weight: 600; }
                    .summary-row span:last-child { color: #ffd700; font-weight: 700; }
                    .summary-row.total { font-size: 1.5rem; font-weight: 900; color: #00d4ff; padding-top: 15px; margin-top: 10px; border-top: 3px solid #ff3333; }
                    .summary-row.total span:last-child { color: #00d4ff; text-shadow: 0 0 10px rgba(0, 212, 255, 0.5); }
                    .footer { margin-top: 30px; padding: 25px; text-align: center; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border-top: 3px solid #ff3333; }
                    .footer p { color: #888888; margin: 10px 0; font-size: 0.95rem; line-height: 1.6; }
                    .footer .contact { color: #00d4ff; font-weight: 600; margin-top: 15px; }
                    .logo { font-size: 1.5rem; font-weight: 900; color: #ffd700; margin-bottom: 5px; }
                    .thank-you { background: linear-gradient(135deg, #ff3333 0%, #cc0000 100%); color: white; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; font-size: 1.1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🏎️ ISAAC'S CARDEALERSHIP</div>
                        <h1>PURCHASE RECEIPT</h1>
                        <div class="tagline">Premium Vehicles • Exceptional Service</div>
                    </div>
                    <div class="content">
                        <p class="greeting">Thank you for your purchase!</p>
                        <div class="order-info">
                            <div class="order-id">Order #${orderId}</div>
                            <div class="order-date">📅 ${new Date().toLocaleString()}</div>
                        </div>
                        
                        <div class="thank-you">
                            ✓ Your Order Has Been Confirmed
                        </div>
                        
                        <h3 class="section-title">🚗 Vehicle Details</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Vehicle</th>
                                    <th style="text-align: center;">Qty</th>
                                    <th style="text-align: right;">Price</th>
                                    <th style="text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>

                        <div class="summary">
                            <div class="summary-row">
                                <span>Subtotal:</span>
                                <span>$${subtotal.toFixed(2)}</span>
                            </div>
                            <div class="summary-row">
                                <span>Tax (10%):</span>
                                <span>$${tax.toFixed(2)}</span>
                            </div>
                            <div class="summary-row total">
                                <span>TOTAL PAID:</span>
                                <span>$${total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div class="footer">
                            <p>We appreciate your business and trust in Isaac's Cardealership.</p>
                            <p>Your vehicle will be prepared for delivery shortly.</p>
                            <div class="contact">
                                📞 Questions? Contact our support team<br>
                                📧 support@isaacscardealership.com
                            </div>
                            <p style="margin-top: 20px; font-size: 0.85rem; color: #666;">
                                This is an automated receipt. Please keep it for your records.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Send email
        const result = await transporter.sendMail({
            from: `"Isaac's Cardealership" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `🏎️ Vehicle Purchase Confirmation - Order #${orderId}`,
            html: htmlBody
        });

        console.log('E-receipt sent to:', email);
        return { success: true, message: 'E-receipt sent', result };
    } catch (error) {
        console.error('Error sending e-receipt:', error);
        return { success: false, message: 'Failed to send e-receipt', error };
    }
}

/**
 * Send refund notification to the customer
 * @param {string} email - Customer email address
 * @param {string} orderId - Order ID
 * @param {number} refundAmount - Refund amount
 * @param {string} reason - Reason for refund
 */
async function sendRefundNotification(email, orderId, refundAmount, reason) {
    try {
        if (!process.env.EMAIL_USER) {
            console.warn('Email service not configured. Skipping refund notification.');
            return { success: false, message: 'Email service not configured' };
        }

        const htmlBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
                    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
                    .order-id { font-size: 1.2rem; font-weight: bold; color: #28a745; margin: 10px 0; }
                    .refund-amount { font-size: 1.5rem; font-weight: bold; color: #28a745; margin: 15px 0; }
                    .info-box { background: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
                    .footer { margin-top: 20px; text-align: center; font-size: 0.9rem; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ Refund Processed</h1>
                    </div>
                    <div class="content">
                        <p>We have processed a refund for your order.</p>
                        <div class="order-id">Order ID: ${orderId}</div>
                        <div class="refund-amount">Refund Amount: $${refundAmount.toFixed(2)}</div>
                        
                        <div class="info-box">
                            <h4 style="margin-top: 0;">Refund Details</h4>
                            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                            <p><strong>Reason:</strong> ${reason || 'N/A'}</p>
                            <p><strong>Processing Time:</strong> 5-10 business days</p>
                        </div>

                        <p style="margin-top: 20px;">
                            The refund will be credited back to your original payment method within 5-10 business days. 
                            The exact timing depends on your bank or card issuer.
                        </p>

                        <div class="footer">
                            <p>If you have any questions about this refund, please contact our support team.</p>
                            <p style="margin-top: 20px; font-size: 0.85rem;">Thank you for your patience and understanding.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Send email
        const result = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Refund Processed - Order ${orderId}`,
            html: htmlBody
        });

        console.log('Refund notification sent to:', email);
        return { success: true, message: 'Refund notification sent', result };
    } catch (error) {
        console.error('Error sending refund notification:', error);
        return { success: false, message: 'Failed to send refund notification', error };
    }
}

/**
 * Send gift card email
 * @param {string} recipientEmail - Recipient email address
 * @param {string} recipientName - Recipient name
 * @param {string} code - Gift card code
 * @param {number} amount - Gift card amount
 * @param {string} message - Personal message
 * @param {string} senderName - Sender's name
 */
async function sendGiftCard(recipientEmail, recipientName, code, amount, message, senderName) {
    try {
        if (!process.env.EMAIL_USER) {
            console.warn('Email service not configured. Skipping gift card send.');
            return { success: false, message: 'Email service not configured' };
        }

        const htmlBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .gift-card { background: white; padding: 30px; margin: 0; border-radius: 0 0 8px 8px; text-align: center; }
                    .code { font-size: 2rem; font-weight: bold; color: #667eea; letter-spacing: 2px; padding: 20px; background: #f0f4ff; border-radius: 8px; margin: 20px 0; font-family: 'Courier New', monospace; }
                    .amount { font-size: 1.5rem; color: #28a745; font-weight: bold; margin: 15px 0; }
                    .message-box { background: #fff9e6; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; text-align: left; }
                    .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px; }
                    .footer { text-align: center; font-size: 0.9rem; color: #999; margin-top: 20px; padding: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎁 You've Received a Gift Card!</h1>
                    </div>
                    <div class="gift-card">
                        <h2>Hi ${recipientName || 'there'}!</h2>
                        <p style="font-size: 1.1rem;">${senderName} has sent you a gift card worth</p>
                        <div class="amount">$${amount.toFixed(2)}</div>
                        ${message ? `<div class="message-box"><strong>Personal Message:</strong><br>${message}</div>` : ''}
                        <p style="margin-top: 30px;"><strong>Your Gift Card Code:</strong></p>
                        <div class="code">${code}</div>
                        <p style="color: #666; margin-top: 20px;">Use this code at checkout to redeem your gift card!</p>
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/giftcards/balance" class="btn">
                            Check Balance
                        </a>
                        <div class="footer">
                            This gift card will expire in 1 year from the date of purchase.<br>
                            For support, contact our customer service team.
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"Supermarket Gift Cards" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `🎁 You've Received a $${amount.toFixed(2)} Gift Card!`,
            html: htmlBody
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Gift card email sent to:', recipientEmail);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending gift card email:', error);
        throw error;
    }
}

// Verify transporter connectivity (returns a Promise)
function verifyTransporter() {
    return transporter.verify();
}

module.exports = { sendEReceipt, sendRefundNotification, sendGiftCard, verifyTransporter };
