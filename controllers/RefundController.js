const db = require('../db');
const paypal = require('../services/paypal');
const stripeService = require('../services/stripe');
const emailService = require('../utils/emailService');

const RefundController = {
    // Get order history for customer
    getOrderHistory(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        
        const sql = `
            SELECT o.*, 
                   GROUP_CONCAT(CONCAT(oi.productName, ' (x', oi.quantity, ')') SEPARATOR ', ') as items,
                   (SELECT COUNT(*) FROM refund_requests WHERE order_id = o.orderId) as refund_request_count
            FROM orders o
            LEFT JOIN order_items oi ON o.orderId = oi.orderId
            WHERE o.userId = ?
            GROUP BY o.orderId
            ORDER BY o.orderDate DESC
        `;
        
        db.query(sql, [userId], (err, orders) => {
            if (err) {
                console.error('Error fetching orders:', err);
                req.flash('error', 'Error loading order history');
                return res.redirect('/');
            }
            
            res.render('orders/history', {
                user: req.session.user,
                orders: orders || [],
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        });
    },

    // Show refund request form
    showRefundForm(req, res) {
        const orderId = req.params.orderId;
        const userId = req.session.user.userId || req.session.user.id;
        
        // Get order details
        const orderSql = `
            SELECT o.orderId, o.userId, o.subtotal, o.tax, o.total, o.orderDate,
                   oi.itemId, oi.productId, oi.productName, oi.quantity, oi.price,
                   p.seller_id, p.image
            FROM orders o
            JOIN order_items oi ON o.orderId = oi.orderId
            JOIN products p ON oi.productId = p.id
            WHERE o.orderId = ? AND o.userId = ?
        `;
        
        db.query(orderSql, [orderId, userId], (err, results) => {
            if (err) {
                console.error('Error fetching order for refund form:', err);
                req.flash('error', 'Error loading refund form: ' + err.message);
                return res.redirect('/orders');
            }
            
            if (!results || results.length === 0) {
                console.log('No order found for orderId:', orderId, 'userId:', userId);
                req.flash('error', 'Order not found');
                return res.redirect('/orders');
            }
            
            try {
                const order = results[0];
                const items = results;
                
                console.log('Rendering refund form for order:', order.orderId);
                res.render('orders/refund-request', {
                    user: req.session.user,
                    order: order,
                    items: items,
                    messages: {
                        success: req.flash('success'),
                        error: req.flash('error')
                    }
                });
            } catch (renderErr) {
                console.error('Error rendering refund form:', renderErr);
                req.flash('error', 'Error displaying refund form');
                res.redirect('/orders');
            }
        });
    },

    // Process refund request
    requestRefund(req, res) {
        const orderId = req.params.orderId;
        const userId = req.session.user.userId || req.session.user.id;
        const { productId, reason, amount } = req.body;
        
        if (!productId || !reason || !amount) {
            req.flash('error', 'All fields are required');
            return res.redirect(`/orders/${orderId}/refund`);
        }
        
        // Verify order ownership and get seller_id
        const verifySql = `
            SELECT o.*, oi.*, p.seller_id, p.price
            FROM orders o
            JOIN order_items oi ON o.orderId = oi.orderId
            JOIN products p ON oi.productId = p.id
            WHERE o.orderId = ? AND o.userId = ? AND oi.productId = ?
        `;
        
        db.query(verifySql, [orderId, userId, productId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error verifying order:', err);
                req.flash('error', 'Invalid request');
                return res.redirect('/orders');
            }
            
            const orderItem = results[0];
            const refundAmount = parseFloat(amount);
            
            // Calculate admin commission (10% of the sale)
            const adminCommission = refundAmount * 0.1;
            
            // Create refund request
            const insertSql = `
                INSERT INTO refund_requests 
                (order_id, product_id, customer_id, seller_id, amount, admin_commission, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            `;
            
            db.query(insertSql, [orderId, productId, userId, orderItem.seller_id, refundAmount, adminCommission, reason], (insertErr) => {
                if (insertErr) {
                    console.error('Error creating refund request:', insertErr);
                    req.flash('error', 'Failed to submit refund request');
                    return res.redirect('/orders');
                }
                
                req.flash('success', 'Refund request submitted successfully. The seller will review your request.');
                res.redirect('/orders');
            });
        });
    },

    // Get seller's pending refund requests
    getSellerRefundRequests(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        
        const sql = `
            SELECT rr.*, 
                   o.orderId, o.orderDate, o.total as orderTotal,
                   p.productName, p.image,
                   u.username as customerName, u.email as customerEmail
            FROM refund_requests rr
            JOIN orders o ON rr.order_id = o.orderId
            JOIN products p ON rr.product_id = p.id
            JOIN users u ON rr.customer_id = u.id
            WHERE rr.seller_id = ?
            ORDER BY rr.requested_at DESC
        `;
        
        db.query(sql, [userId], (err, requests) => {
            if (err) {
                console.error('Error fetching refund requests:', err);
                return res.json({ error: 'Error loading refund requests' });
            }
            
            res.json({ requests: requests || [] });
        });
    },

    // Approve refund request
    approveRefund(req, res) {
        const refundId = req.params.id;
        const userId = req.session.user.userId || req.session.user.id;
        const { restoreInventory } = req.body;
        
        // Get refund request details with payment information and customer email
        const getSql = `
            SELECT rr.*, p.quantity, p.productName, o.paymentProvider, o.paymentReference,
                   u.email as customerEmail, u.username as customerName
            FROM refund_requests rr
            JOIN products p ON rr.product_id = p.id
            JOIN orders o ON rr.order_id = o.orderId
            JOIN users u ON rr.customer_id = u.id
            WHERE rr.id = ? AND rr.seller_id = ? AND rr.status = 'pending'
        `;
        
        db.query(getSql, [refundId, userId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching refund request:', err);
                req.flash('error', 'Refund request not found or already processed');
                return res.redirect('/seller/dashboard');
            }
            
            const refund = results[0];
            
            // Get a connection from the pool for transaction
            db.getConnection((connErr, conn) => {
                if (connErr) {
                    console.error('Could not get DB connection from pool:', connErr);
                    req.flash('error', 'Database error');
                    return res.redirect('/seller/dashboard');
                }
                
                // Start transaction
                conn.beginTransaction((transErr) => {
                    if (transErr) {
                        conn.release();
                        console.error('Transaction error:', transErr);
                        req.flash('error', 'Error processing refund');
                        return res.redirect('/seller/dashboard');
                    }
                    
                    // Update refund status
                    const updateRefundSql = `
                        UPDATE refund_requests 
                        SET status = 'approved', 
                            processed_at = NOW(), 
                            processed_by = ?,
                            restore_inventory = ?
                        WHERE id = ?
                    `;
                    
                    conn.query(updateRefundSql, [userId, restoreInventory ? 1 : 0, refundId], (updateErr) => {
                        if (updateErr) {
                            return conn.rollback(() => {
                                conn.release();
                                console.error('Error updating refund:', updateErr);
                                req.flash('error', 'Error processing refund');
                                res.redirect('/seller/dashboard');
                            });
                        }
                        
                        // Restore inventory if requested
                        if (restoreInventory) {
                            const restoreSql = 'UPDATE products SET quantity = quantity + 1 WHERE id = ?';
                            conn.query(restoreSql, [refund.product_id], (restoreErr) => {
                                if (restoreErr) {
                                    return conn.rollback(() => {
                                        conn.release();
                                        console.error('Error restoring inventory:', restoreErr);
                                        req.flash('error', 'Error restoring inventory');
                                        res.redirect('/seller/dashboard');
                                    });
                                }
                                
                                commitRefund();
                            });
                        } else {
                            commitRefund();
                        }
                    });
                    
                    function commitRefund() {
                        // Process payment gateway refund first (if applicable)
                        let paymentGatewayRefunded = false;
                        let refundError = null;
                        
                        // Check if payment needs to be refunded through the gateway
                        if (refund.paymentProvider && refund.paymentReference) {
                            console.log(`Processing ${refund.paymentProvider} refund for ${refund.amount}`);
                            
                            // Process Stripe refund
                            if (refund.paymentProvider === 'Stripe' && refund.paymentReference) {
                                stripeService.createRefund(refund.paymentReference, refund.amount, 'sgd')
                                    .then(result => {
                                        if (result.success) {
                                            console.log('Stripe refund successful:', result.refundId);
                                            paymentGatewayRefunded = true;
                                            continueRefund();
                                        } else {
                                            console.error('Stripe refund failed:', result.error);
                                            refundError = 'Stripe refund failed: ' + result.error;
                                            continueRefund();
                                        }
                                    })
                                    .catch(err => {
                                        console.error('Stripe refund error:', err);
                                        refundError = 'Stripe refund error: ' + err.message;
                                        continueRefund();
                                    });
                            } 
                            // Process PayPal refund
                            else if (refund.paymentProvider === 'PayPal' && refund.paymentReference) {
                                paypal.refundCapture(refund.paymentReference, refund.amount, 'SGD')
                                    .then(result => {
                                        if (result.id || result.status === 'COMPLETED') {
                                            console.log('PayPal refund successful');
                                            paymentGatewayRefunded = true;
                                            continueRefund();
                                        } else {
                                            console.error('PayPal refund failed:', result);
                                            refundError = 'PayPal refund failed';
                                            continueRefund();
                                        }
                                    })
                                    .catch(err => {
                                        console.error('PayPal refund error:', err);
                                        refundError = 'PayPal refund error: ' + err.message;
                                        continueRefund();
                                    });
                            } else {
                                continueRefund();
                            }
                        } else {
                            continueRefund();
                        }
                        
                        function continueRefund() {
                            // Update order refund status and mark as refunded
                            const updateOrderSql = `
                                UPDATE orders 
                                SET refundedAmount = refundedAmount + ?,
                                    refundStatus = CASE 
                                        WHEN refundedAmount + ? >= total THEN 'full'
                                        ELSE 'partial'
                                    END
                                WHERE orderId = ?
                            `;
                            
                            conn.query(updateOrderSql, [refund.amount, refund.amount, refund.order_id], (orderErr) => {
                                if (orderErr) {
                                    return conn.rollback(() => {
                                        conn.release();
                                        console.error('Error updating order:', orderErr);
                                        req.flash('error', 'Error processing refund');
                                        res.redirect('/seller/dashboard');
                                    });
                                }
                                
                                // Deduct refunded amount from seller's revenue in admin_revenue
                                const deductRevenueSQL = `
                                    UPDATE admin_revenue 
                                    SET sale_amount = sale_amount - ?,
                                        commission_amount = commission_amount - ?
                                    WHERE order_id = ? AND seller_id = ?
                                `;
                            
                                conn.query(deductRevenueSQL, [refund.amount, refund.admin_commission, refund.order_id, userId], (revenueErr) => {
                                    if (revenueErr) {
                                        console.error('Error deducting revenue:', revenueErr);
                                        // Continue anyway - revenue tracking is not critical for transaction success
                                    }
                                    
                                    // Commit transaction
                                    conn.commit((commitErr) => {
                                        if (commitErr) {
                                            return conn.rollback(() => {
                                                conn.release();
                                                console.error('Commit error:', commitErr);
                                                req.flash('error', 'Error processing refund');
                                                res.redirect('/seller/dashboard');
                                            });
                                        }
                                        
                                        conn.release();
                                        
                                        // Send refund notification email to customer
                                        emailService.sendRefundNotification(
                                            refund.customerEmail,
                                            refund.order_id,
                                            refund.amount,
                                            refund.reason
                                        ).then(emailResult => {
                                            if (emailResult.success) {
                                                console.log('Refund notification email sent successfully to:', refund.customerEmail);
                                            } else {
                                                console.warn('Failed to send refund notification email:', emailResult.message);
                                            }
                                        }).catch(emailErr => {
                                            console.error('Error sending refund notification email:', emailErr);
                                        });
                                        
                                        req.flash('success', 'Refund approved successfully' + (refundError ? ' (Payment gateway: ' + refundError + ')' : ''));
                                        res.redirect('/seller/dashboard');
                                    });
                                });
                            });
                        }
                    }
                });
            });
        });
    },

    // Reject refund request
    rejectRefund(req, res) {
        const refundId = req.params.id;
        const userId = req.session.user.userId || req.session.user.id;
        const { rejectionReason } = req.body;
        
        const sql = `
            UPDATE refund_requests 
            SET status = 'rejected', 
                processed_at = NOW(), 
                processed_by = ?,
                reason = CONCAT(reason, '\n\nRejection reason: ', ?)
            WHERE id = ? AND seller_id = ? AND status = 'pending'
        `;
        
        db.query(sql, [userId, rejectionReason || 'No reason provided', refundId, userId], (err, result) => {
            if (err) {
                console.error('Error rejecting refund:', err);
                req.flash('error', 'Error processing request');
                return res.redirect('/seller/dashboard');
            }
            
            if (result.affectedRows === 0) {
                req.flash('error', 'Refund request not found or already processed');
                return res.redirect('/seller/dashboard');
            }
            
            req.flash('success', 'Refund request rejected');
            res.redirect('/seller/dashboard');
        });
    },

    // Admin - View all refunds
    adminGetAllRefunds(req, res) {
        const sql = `
            SELECT rr.*, 
                   o.orderId, o.orderDate, o.total as orderTotal,
                   p.productName, p.image,
                   c.username as customerName, c.email as customerEmail,
                   s.username as sellerName
            FROM refund_requests rr
            JOIN orders o ON rr.order_id = o.orderId
            JOIN products p ON rr.product_id = p.id
            JOIN users c ON rr.customer_id = c.id
            JOIN users s ON rr.seller_id = s.id
            ORDER BY rr.requested_at DESC
        `;
        
        db.query(sql, (err, refunds) => {
            if (err) {
                console.error('Error fetching refunds:', err);
                req.flash('error', 'Error loading refunds');
                return res.redirect('/admin/dashboard');
            }
            
            // Get commission stats
            const statsSql = `
                SELECT 
                    SUM(commission_amount) as totalCommission,
                    COUNT(*) as totalOrders,
                    SUM(sale_amount) as totalSales
                FROM admin_revenue
            `;
            
            db.query(statsSql, (statsErr, statsResults) => {
                const stats = statsResults && statsResults[0] ? statsResults[0] : {
                    totalCommission: 0,
                    totalOrders: 0,
                    totalSales: 0
                };
                
                res.render('admin/refunds-marketplace', {
                    user: req.session.user,
                    refunds: refunds || [],
                    stats: stats,
                    messages: {
                        success: req.flash('success'),
                        error: req.flash('error')
                    }
                });
            });
        });
    }
};

module.exports = RefundController;
