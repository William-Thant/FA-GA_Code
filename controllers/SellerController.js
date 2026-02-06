const db = require('../db');

const SellerController = {
    // Seller dashboard
    dashboard(req, res) {
        const userId = req.session.user.userId || req.session.user.id;

        // Check if user is an approved seller
        db.query('SELECT is_seller, seller_status FROM users WHERE id = ?', [userId], (err, userResults) => {
            if (err || userResults.length === 0) {
                console.error('Error fetching user:', err);
                req.flash('error', 'User not found');
                return res.redirect('/settings');
            }

            const user = userResults[0];
            if (!user.is_seller || user.seller_status !== 'approved') {
                req.flash('error', 'You must be an approved seller to access this page');
                return res.redirect('/settings');
            }

            // Get seller profile
            db.query('SELECT * FROM seller_profile WHERE user_id = ?', [userId], (profileErr, profileResults) => {
                if (profileErr) {
                    console.error('Error fetching seller profile:', profileErr);
                }

                const sellerProfile = profileResults && profileResults.length > 0 ? profileResults[0] : null;

                // Get all vehicles for this seller with view counts
                const vehiclesSql = `
                    SELECT p.*, 
                           COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.productId = p.id), 0) as order_count,
                           COALESCE((SELECT COUNT(*) FROM vehicle_views vv WHERE vv.vehicle_id = p.id), 0) as views
                    FROM products p
                    WHERE p.seller_id = ?
                    ORDER BY p.id DESC
                `;

                db.query(vehiclesSql, [userId], (vehiclesErr, vehicles) => {
                    if (vehiclesErr) {
                        console.error('Error fetching vehicles:', vehiclesErr);
                        vehicles = [];
                    }

                    // Calculate statistics
                    const totalVehicles = vehicles.length;
                    const activeListings = vehicles.filter(v => v.quantity > 0).length;
                    const outOfStock = vehicles.filter(v => v.quantity === 0).length;
                    const totalViews = vehicles.reduce((sum, v) => sum + (v.views || 0), 0);

                    // Get recent orders for seller's vehicles (for display)
                    const ordersSql = `
                        SELECT o.*, p.productName, p.image, u.username as customerName, u.email as customerEmail,
                               o.refundedAmount, o.refundStatus
                        FROM orders o
                        JOIN order_items oi ON o.orderId = oi.orderId
                        JOIN products p ON oi.productId = p.id
                        JOIN users u ON o.userId = u.id
                        WHERE p.seller_id = ?
                        ORDER BY o.orderDate DESC
                        LIMIT 10
                    `;
                    
                    // Get ALL orders for statistics calculation
                    const allOrdersSql = `
                        SELECT o.seller_earnings, o.total, o.refundedAmount, o.refundStatus
                        FROM orders o
                        JOIN order_items oi ON o.orderId = oi.orderId
                        JOIN products p ON oi.productId = p.id
                        WHERE p.seller_id = ?
                    `;

                    db.query(ordersSql, [userId], (ordersErr, recentOrders) => {
                        if (ordersErr) {
                            console.error('Error fetching recent orders:', ordersErr);
                            recentOrders = [];
                        }

                        db.query(allOrdersSql, [userId], (allOrdersErr, allOrders) => {
                            if (allOrdersErr) {
                                console.error('Error fetching all orders:', allOrdersErr);
                                allOrders = [];
                            }

                            // Count only non-fully-refunded orders as sales
                            const totalSales = allOrders.filter(o => o.refundStatus !== 'full').length;
                            
                            // Calculate total revenue minus refunded amounts
                            // Use seller_earnings (90%) for total revenue shown to seller
                            const totalRevenue = allOrders.reduce((sum, o) => {
                                const orderRevenue = parseFloat(o.seller_earnings) || parseFloat(o.total) * 0.90 || 0;
                                const refundedAmount = parseFloat(o.refundedAmount) || 0;
                                // Deduct refunded portion from seller's earnings (90% of refunded amount)
                                const refundedFromSeller = refundedAmount * 0.90;
                                return sum + (orderRevenue - refundedFromSeller);
                            }, 0);

                            res.render('seller/dashboard', {
                                user: req.session.user,
                                sellerProfile: sellerProfile,
                                vehicles: vehicles,
                                recentOrders: recentOrders,
                                statistics: {
                                    totalVehicles,
                                    activeListings,
                                    outOfStock,
                                    totalViews,
                                    totalSales,
                                    totalRevenue
                                },
                                messages: {
                                    success: req.flash('success'),
                                    error: req.flash('error')
                                }
                            });
                        });
                    });
                });
            });
        });
    },

    // Delete a vehicle listing
    deleteVehicle(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const vehicleId = req.params.id;

        // Verify ownership
        db.query('SELECT seller_id FROM products WHERE id = ?', [vehicleId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching vehicle:', err);
                req.flash('error', 'Vehicle not found');
                return res.redirect('/seller/dashboard');
            }

            if (results[0].seller_id !== userId) {
                req.flash('error', 'You do not have permission to delete this vehicle');
                return res.redirect('/seller/dashboard');
            }

            // Delete the vehicle
            db.query('DELETE FROM products WHERE id = ?', [vehicleId], (deleteErr) => {
                if (deleteErr) {
                    console.error('Error deleting vehicle:', deleteErr);
                    req.flash('error', 'Failed to delete vehicle');
                    return res.redirect('/seller/dashboard');
                }

                req.flash('success', 'Vehicle deleted successfully');
                res.redirect('/seller/dashboard');
            });
        });
    },

    // Mark vehicle as sold (set stock to 0)
    markAsSold(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const vehicleId = req.params.id;

        // Verify ownership
        db.query('SELECT seller_id FROM products WHERE id = ?', [vehicleId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching vehicle:', err);
                req.flash('error', 'Vehicle not found');
                return res.redirect('/seller/dashboard');
            }

            if (results[0].seller_id !== userId) {
                req.flash('error', 'You do not have permission to modify this vehicle');
                return res.redirect('/seller/dashboard');
            }

            // Update stock to 0
            db.query('UPDATE products SET quantity = 0 WHERE id = ?', [vehicleId], (updateErr) => {
                if (updateErr) {
                    console.error('Error updating vehicle:', updateErr);
                    req.flash('error', 'Failed to mark vehicle as sold');
                    return res.redirect('/seller/dashboard');
                }

                req.flash('success', 'Vehicle marked as sold');
                res.redirect('/seller/dashboard');
            });
        });
    },

    // Show add vehicle form
    showAddVehicleForm(req, res) {
        res.render('seller/add-vehicle', {
            user: req.session.user,
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            }
        });
    },

    // Handle add vehicle submission
    addVehicle(req, res) {
        const { productName, price, quantity, category, mileage, year } = req.body;
        const userId = req.session.user.userId || req.session.user.id;
        const image = req.file ? req.file.filename : 'default-car.svg';

        // Validation
        if (!productName || !price || !quantity || !category) {
            req.flash('error', 'All fields are required');
            return res.redirect('/seller/add-vehicle');
        }

        const sql = `INSERT INTO products (productName, price, quantity, image, category, seller_id, mileage, year) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        db.query(sql, [productName, price, quantity, image, category, userId, mileage || null, year || null], (err, result) => {
            if (err) {
                console.error('Error adding vehicle:', err);
                req.flash('error', 'Failed to add vehicle');
                return res.redirect('/seller/add-vehicle');
            }

            req.flash('success', 'Vehicle added successfully!');
            res.redirect('/seller/dashboard');
        });
    },

    // Update seller profile
    updateProfile(req, res) {
        const { business_name, business_phone, business_address, business_description } = req.body;
        const userId = req.session.user.userId || req.session.user.id;

        // Validation
        if (!business_name || !business_phone || !business_address || !business_description) {
            req.flash('error', 'All fields are required');
            return res.redirect('/seller/dashboard');
        }

        const sql = `UPDATE seller_profile 
                     SET business_name = ?, business_phone = ?, business_address = ?, business_description = ?
                     WHERE user_id = ?`;

        db.query(sql, [business_name, business_phone, business_address, business_description, userId], (err, result) => {
            if (err) {
                console.error('Error updating profile:', err);
                req.flash('error', 'Failed to update profile');
                return res.redirect('/seller/dashboard');
            }

            req.flash('success', 'Profile updated successfully!');
            res.redirect('/seller/dashboard');
        });
    }
};

module.exports = SellerController;
