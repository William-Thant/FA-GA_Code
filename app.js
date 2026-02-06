require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const axios = require('axios');
const db = require('./db');
const middleware = require('./middleware');
const UserController = require('./controllers/UserController');
const FinesController = require('./controllers/FinesController');
const CartItemsController = require('./controllers/CartItemsController');
const SettingsController = require('./controllers/SettingsController');
const ChatbotController = require('./controllers/ChatbotController');
const AdminSellerController = require('./controllers/AdminSellerController');
const SellerController = require('./controllers/SellerController');
const DiscountCode = require('./models/DiscountCode');
const Wallet = require('./models/Wallet');
const netsQr = require('./services/nets');
const paypal = require('./services/paypal');
const stripeService = require('./services/stripe');
const bcrypt = require('bcrypt');
const emailService = require('./utils/emailService');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        // Generate unique filename to prevent overwrite and path traversal
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = file.originalname.split('.').pop();
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext); 
    }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// use shared db pool (db is a pool object)
const connection = db;

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));
// enable JSON body parsing for AJAX requests
app.use(express.json());

//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true, // Prevent XSS attacks
        secure: process.env.NODE_ENV === 'production' // Use HTTPS in production
    } 
}));

app.use(flash());

// re-use middleware from merged app
const checkAuthenticated = middleware.checkAuthenticated;
const checkAuthorised = middleware.checkAuthorised;
const checkAdmin = checkAuthorised(['admin']);
const checkSeller = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', 'Please log in');
        return res.redirect('/login');
    }
    if (!req.session.user.is_seller || req.session.user.seller_status !== 'approved') {
        req.flash('error', 'You must be an approved seller to access this page');
        return res.redirect('/settings');
    }
    next();
};

// expose user to views
app.use((req, res, next) => { res.locals.user = req.session.user; next(); });

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        req.flash('error', 'All fields are required');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/',  (req, res) => {
    res.render('index', {user: req.session.user} );
});

app.get('/inventory', checkAuthenticated, checkAdmin, (req, res) => {
    const search = req.query.search ? req.query.search.trim() : '';
    const category = req.query.category ? req.query.category.trim() : '';
    const sort = req.query.sort ? req.query.sort.trim() : '';
    
    // Build dynamic SQL query
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    
    if (search) {
        sql += ' AND productName LIKE ?';
        params.push(`%${search}%`);
    }
    
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    
    // Add ORDER BY clause based on sort parameter
    if (sort === 'name_asc') {
        sql += ' ORDER BY productName ASC';
    } else if (sort === 'name_desc') {
        sql += ' ORDER BY productName DESC';
    } else if (sort === 'stock_high') {
        sql += ' ORDER BY quantity DESC';
    } else if (sort === 'stock_low') {
        sql += ' ORDER BY quantity ASC';
    } else {
        sql += ' ORDER BY id DESC'; // default: newest first
    }
    
    // First get distinct categories for filter dropdown
    connection.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""', (catErr, categories) => {
        if (catErr) {
            console.error('Error fetching categories:', catErr);
            categories = [];
        }
        
        // Then get filtered products
        connection.query(sql, params, (error, results) => {
            if (error) throw error;
            res.render('admin/inventory', { 
                products: results,
                categories: categories || [],
                search: search,
                selectedCategory: category,
                selectedSort: sort,
                user: req.session.user,
                messages: { error: req.flash('error'), success: req.flash('success') }
            });
        });
    });
});

app.get('/register', (req, res) => {
    res.render('auth/register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {

    const { firstName, lastName, email, password, address, contact } = req.body;
    const username = `${firstName} ${lastName}`;
    const role = 'user'; // Default all new registrations to user role

    // Check if email already exists
    connection.query('SELECT id FROM users WHERE email = ?', [email], (checkErr, existingUsers) => {
        if (checkErr) {
            console.error('Error checking email:', checkErr);
            req.flash('error', 'Server error');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        if (existingUsers.length > 0) {
            req.flash('error', 'Email already registered. Please use a different email or login.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        // Hash password with bcrypt before storing
        bcrypt.hash(password, 10, (hashErr, hash) => {
            if (hashErr) {
                console.error('Error hashing password:', hashErr);
                req.flash('error', 'Server error');
                req.flash('formData', req.body);
                return res.redirect('/register');
            }
            const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)';
            connection.query(sql, [username, email, hash, address || '', contact || '', role], (err, result) => {
                if (err) {
                    console.error(err);
                    req.flash('error', 'Could not register user');
                    req.flash('formData', req.body);
                    return res.redirect('/register');
                }
                req.flash('success', 'Registration successful! Please log in.');
                res.redirect('/login');
            });
        });
    });
});

// Authentication routes (use merged UserController)
app.get('/login', UserController.loginForm);
app.post('/login', UserController.login);
app.get('/logout', UserController.logout);

// Settings routes
app.get('/settings', checkAuthenticated, SettingsController.index);
app.post('/settings/profile', checkAuthenticated, SettingsController.updateProfile);
app.post('/settings/password', checkAuthenticated, SettingsController.changePassword);
app.post('/settings/notifications', checkAuthenticated, SettingsController.updateNotifications);
app.post('/settings/delete-account', checkAuthenticated, SettingsController.deleteAccount);
app.post('/settings/apply-seller', checkAuthenticated, SettingsController.applySeller);

app.get('/shop', checkAuthenticated, (req, res) => {
    const search = req.query.search ? req.query.search.trim() : '';
    const category = req.query.category ? req.query.category.trim() : '';
    const sort = req.query.sort ? req.query.sort.trim() : '';
    
    // Build dynamic SQL query
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    
    if (search) {
        sql += ' AND productName LIKE ?';
        params.push(`%${search}%`);
    }
    
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    
    // Add ORDER BY clause based on sort parameter
    if (sort === 'name_asc') {
        sql += ' ORDER BY productName ASC';
    } else if (sort === 'name_desc') {
        sql += ' ORDER BY productName DESC';
    } else if (sort === 'stock_high') {
        sql += ' ORDER BY quantity DESC';
    } else if (sort === 'stock_low') {
        sql += ' ORDER BY quantity ASC';
    } else {
        sql += ' ORDER BY id DESC'; // default: newest first
    }
    
    // First get distinct categories for filter dropdown
    connection.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""', (catErr, categories) => {
        if (catErr) {
            console.error('Error fetching categories:', catErr);
            categories = [];
        }
        
        // Then get filtered products
        connection.query(sql, params, (error, results) => {
            if (error) throw error;
            res.render('products/list', { 
                user: req.session.user, 
                products: results,
                categories: categories || [],
                search: search,
                selectedCategory: category,
                selectedSort: sort
            });
        });
    });
});

// Keep `/shopping` for backward-compatibility but redirect to canonical `/shop`
app.get('/shopping', checkAuthenticated, (req, res) => {
    return res.redirect('/shop');
});

// ======= Wallet Routes =======
// Wallet top-up page
app.get('/wallet/topup', checkAuthenticated, (req, res) => {
    if (!req.session.user || !req.session.user.userId) {
        console.error('User session invalid');
        req.flash('error', 'Please log in to access wallet');
        return res.redirect('/login');
    }
    
    Wallet.getBalance(req.session.user.userId, (err, balance) => {
        if (err) {
            console.error('Error fetching wallet balance:', err);
            req.flash('error', 'Error loading wallet');
            return res.redirect('/');
        }
        res.render('wallet/topup', { 
            user: req.session.user,
            walletBalance: balance,
            process: process,
            messages: { error: req.flash('error'), success: req.flash('success') }
        });
    });
});

// Wallet Stripe top-up
app.get('/wallet/topup/stripe', checkAuthenticated, async (req, res) => {
    const amount = parseFloat(req.query.amount);
    
    if (!amount || amount < 10 || amount > 100000) {
        req.flash('error', 'Invalid amount. Please enter an amount between $10 and $100,000');
        return res.redirect('/wallet/topup');
    }
    
    try {
        const result = await stripeService.createPaymentIntent(
            amount,
            'sgd',
            { type: 'wallet_topup', userId: req.session.user.userId.toString() }
        );
        
        if (!result.success) {
            console.error('Stripe error:', result.error);
            req.flash('error', 'Failed to initialize payment');
            return res.redirect('/wallet/topup');
        }
        
        res.render('stripeCheckout', {
            user: req.session.user,
            clientSecret: result.clientSecret,
            amount: amount,
            type: 'wallet_topup'
        });
    } catch (error) {
        console.error('Stripe wallet topup error:', error);
        req.flash('error', 'Failed to initialize payment');
        res.redirect('/wallet/topup');
    }
});

// Wallet NETS top-up
app.get('/wallet/topup/nets', checkAuthenticated, async (req, res) => {
    const amount = parseFloat(req.query.amount);
    
    if (!amount || amount < 10 || amount > 100000) {
        req.flash('error', 'Invalid amount. Please enter an amount between $10 and $100,000');
        return res.redirect('/wallet/topup');
    }
    
    try {
        const txnRef = `WALLET_${Date.now()}_${req.session.user.userId}`;
        
        const requestBody = {
            txn_id: "sandbox_nets|m|8ff8e5b6-d43e-4786-8ac5-7accf8c5bd9b",
            amt_in_dollars: amount,
            notify_mobile: 0,
        };

        const response = await axios.post(
            `https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/request`,
            requestBody,
            {
                headers: {
                    "api-key": process.env.NETS_API_KEY,
                    "project-id": process.env.NETS_PROJECT_ID,
                },
            }
        );

        const qrData = response.data.result.data;

        if (qrData.response_code === "00" && qrData.txn_status === 1 && qrData.qr_code) {
            req.session.walletTopup = { amount, txnRef: qrData.txn_retrieval_ref };
            
            res.render('netsQr', {
                user: req.session.user,
                total: amount,
                title: "Wallet Top-up - Scan to Pay",
                qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
                txnRetrievalRef: qrData.txn_retrieval_ref,
                networkCode: qrData.network_status,
                timer: 300,
                fullNetsResponse: response.data,
                apiKey: process.env.NETS_API_KEY,
                projectId: process.env.NETS_PROJECT_ID,
                type: 'wallet_topup'
            });
        } else {
            console.error('NETS QR generation failed:', qrData);
            req.flash('error', 'Failed to generate QR code');
            res.redirect('/wallet/topup');
        }
    } catch (error) {
        console.error('NETS wallet topup error:', error);
        req.flash('error', 'Failed to generate QR code');
        res.redirect('/wallet/topup');
    }
});

// Wallet transaction history
app.get('/wallet/history', checkAuthenticated, (req, res) => {
    Wallet.getBalance(req.session.user.userId, (balErr, balance) => {
        if (balErr) {
            console.error('Error fetching wallet balance:', balErr);
            req.flash('error', 'Error loading wallet');
            return res.redirect('/');
        }
        
        Wallet.getTransactions(req.session.user.userId, 50, (txnErr, transactions) => {
            if (txnErr) {
                console.error('Error fetching transactions:', txnErr);
                req.flash('error', 'Error loading transactions');
                return res.redirect('/');
            }
            
            res.render('wallet/history', {
                user: req.session.user,
                walletBalance: balance,
                transactions
            });
        });
    });
});

// PayPal wallet top-up capture
app.post('/wallet/topup/paypal/capture', checkAuthenticated, async (req, res) => {
    try {
        const { orderID, amount } = req.body;
        const capture = await paypal.captureOrder(orderID);
        
        if (capture.status === 'COMPLETED') {
            const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || capture.id || orderID;
            
            Wallet.deposit(
                req.session.user.userId,
                parseFloat(amount),
                'Wallet top-up via PayPal',
                captureId,
                (err, newBalance) => {
                    if (err) {
                        console.error('Error adding wallet funds:', err);
                        return res.json({ success: false, error: 'Failed to add funds' });
                    }
                    res.json({ success: true, balance: newBalance });
                }
            );
        } else {
            res.json({ success: false, error: 'Payment not completed' });
        }
    } catch (error) {
        console.error('PayPal top-up error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Top-up success page
app.get('/wallet/topup/success', checkAuthenticated, (req, res) => {
    const amount = req.query.amount || '0.00';
    res.render('wallet/success', {
        user: req.session.user,
        amount
    });
});

app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1;
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);

    connection.query('SELECT * FROM products WHERE id = ?', [productId], (error, results) => {
        if (error) {
            if (isAjax) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            throw error;
        }

        if (results.length > 0) {
            const product = results[0];

            // Initialize cart in session if not exists (product cart)
            if (!req.session.cart) {
                req.session.cart = [];
            }

            // Check if product already in cart (use `id` as the key)
            const existingItem = req.session.cart.find(item => item.id === productId);
            if (existingItem) {
                // For car dealership, don't allow duplicate vehicles
                if (isAjax) {
                    return res.json({ success: false, message: 'This vehicle is already in your cart' });
                }
                req.flash('error', 'This vehicle is already in your cart');
                const referer = req.get('Referer') || '/shop';
                return res.redirect(referer);
            } else {
                req.session.cart.push({
                    id: product.id,
                    productName: product.productName,
                    price: product.price,
                    quantity: quantity,
                    image: product.image
                });
            }

            // Check if this is an AJAX request
            if (isAjax) {
                return res.json({ success: true, message: 'Vehicle added to cart' });
            }

            // Redirect back to the previous page or shop
            const referer = req.get('Referer') || '/shop';
            res.redirect(referer);
        } else {
            if (isAjax) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
            res.status(404).send("Product not found");
        }
    });
});

app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    const appliedDiscount = req.session.appliedDiscount || null;
    
    // Fetch wallet balance
    Wallet.getBalance(req.session.user.userId, (err, walletBalance) => {
        if (err) {
            console.error('Error fetching wallet balance:', err);
            walletBalance = 0;
        }
        
        res.render('cart', { 
            cart, 
            appliedDiscount,
            walletBalance: walletBalance || 0,
            user: req.session.user,
            messages: { error: req.flash('error'), success: req.flash('success') }
        });
    });
});

// Update cart item quantity
app.post('/cart/update', checkAuthenticated, (req, res) => {
    const { id, quantity } = req.body;
    const qty = parseInt(quantity, 10);
    if (!req.session.cart) return res.redirect('/cart');

    const idx = req.session.cart.findIndex(item => String(item.id) === String(id));
    if (idx === -1) return res.redirect('/cart');

    if (isNaN(qty) || qty < 1) {
        // if user set 0 or invalid, remove item
        req.session.cart.splice(idx, 1);
    } else {
        req.session.cart[idx].quantity = qty;
    }

    // If AJAX request, respond with JSON containing updated totals and item info
    const isAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('Accept') && req.get('Accept').includes('application/json'));
    function computeTotals(cart) {
        let subtotal = 0;
        for (let it of (cart || [])) subtotal += it.price * it.quantity;
        const tax = subtotal * 0.1;
        const commission = subtotal * 0.1;
        const total = subtotal + tax + commission;
        return { subtotal, tax, commission, total };
    }

    if (isAjax) {
        const totals = computeTotals(req.session.cart);
        return res.json({ success: true, id, quantity: qty, totals, cartCount: req.session.cart.length });
    }

    res.redirect('/cart');
});

// Remove cart item
app.post('/cart/remove', checkAuthenticated, (req, res) => {
    const { id } = req.body;
    if (!req.session.cart) return res.redirect('/cart');

    req.session.cart = req.session.cart.filter(item => String(item.id) !== String(id));

    // respond with JSON for AJAX
    const isAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('Accept') && req.get('Accept').includes('application/json'));
    function computeTotals(cart) {
        let subtotal = 0;
        for (let it of (cart || [])) subtotal += it.price * it.quantity;
        const tax = subtotal * 0.1;
        const commission = subtotal * 0.1;
        const total = subtotal + tax + commission;
        return { subtotal, tax, commission, total };
    }

    if (isAjax) {
        const totals = computeTotals(req.session.cart);
        return res.json({ success: true, id, totals, cartCount: req.session.cart.length });
    }

    res.redirect('/cart');
});

// Optional: remove via GET link
app.get('/cart/remove/:id', checkAuthenticated, (req, res) => {
    const id = req.params.id;
    if (!req.session.cart) return res.redirect('/cart');
    req.session.cart = req.session.cart.filter(item => String(item.id) !== String(id));
    res.redirect('/cart');
});

// Clear entire cart
app.post('/cart/clear', checkAuthenticated, (req, res) => {
    req.session.cart = [];
    req.flash('success', 'Cart cleared successfully');
    res.redirect('/cart');
});

// Payment page route
app.get('/payment', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    
    if (cart.length === 0) {
        req.flash('error', 'Your cart is empty');
        return res.redirect('/cart');
    }
    
    // Calculate totals
    let subtotal = 0;
    cart.forEach(item => {
        subtotal += item.price * item.quantity;
    });
    
    const appliedDiscount = req.session.appliedDiscount || null;
    let discount = 0;
    if (appliedDiscount) {
        if (appliedDiscount.type === 'percentage') {
            discount = subtotal * (appliedDiscount.value / 100);
        } else {
            discount = appliedDiscount.value;
        }
    }
    
    const discountedSubtotal = subtotal - discount;
    
    // Add 10% platform commission
    const platformFee = discountedSubtotal * 0.1;
    const subtotalWithFee = discountedSubtotal + platformFee;
    
    const tax = subtotalWithFee * 0.1; // 10% tax on amount after platform fee
    const total = subtotalWithFee + tax;
    
    // Get wallet balance
    Wallet.getBalance(req.session.user.userId, (err, walletBalance) => {
        if (err) {
            console.error('Error fetching wallet balance:', err);
            walletBalance = 0;
        }
        
        res.render('payment', {
            cart,
            subtotal,
            discount,
            platformFee,
            tax,
            total,
            walletBalance: walletBalance || 0,
            appliedDiscount,
            user: req.session.user,
            messages: { error: req.flash('error'), success: req.flash('success') }
        });
    });
});

// Process wallet payment
app.post('/payment/wallet', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    
    if (cart.length === 0) {
        req.flash('error', 'Your cart is empty');
        return res.redirect('/cart');
    }
    
    // Calculate totals
    let subtotal = 0;
    cart.forEach(item => {
        subtotal += item.price * item.quantity;
    });
    
    const appliedDiscount = req.session.appliedDiscount || null;
    let discount = 0;
    if (appliedDiscount) {
        if (appliedDiscount.type === 'percentage') {
            discount = subtotal * (appliedDiscount.value / 100);
        } else {
            discount = appliedDiscount.value;
        }
    }
    
    const discountedSubtotal = subtotal - discount;
    
    // Add 10% platform commission
    const platformFee = discountedSubtotal * 0.1;
    const subtotalWithFee = discountedSubtotal + platformFee;
    
    const tax = subtotalWithFee * 0.1;
    const total = subtotalWithFee + tax;
    const userId = req.session.user.userId;
    
    // Check wallet balance first
    Wallet.getBalance(userId, (err, walletBalance) => {
        if (err) {
            console.error('Error fetching wallet balance:', err);
            req.flash('error', 'Error processing payment. Please try again.');
            return res.redirect('/payment');
        }
        
        if (walletBalance < total) {
            req.flash('error', `Insufficient wallet balance. You have $${walletBalance.toFixed(2)} but need $${total.toFixed(2)}`);
            return res.redirect('/payment');
        }
        
        // Deduct from wallet
        const description = `Purchase of ${cart.length} item(s)`;
        Wallet.deduct(userId, total, description, null, (deductErr, transaction) => {
            if (deductErr) {
                console.error('Error deducting from wallet:', deductErr);
                req.flash('error', 'Error processing payment. Please try again.');
                return res.redirect('/payment');
            }
            
            // Generate unique order ID
            const orderId = 'WLT' + Date.now() + Math.random().toString(36).substring(2, 9).toUpperCase();
            
            // Calculate 90/10 split: 90% to seller, 10% to admin
            const sellerEarnings = Math.round(total * 0.90 * 100) / 100;
            const adminCommission = Math.round(total * 0.10 * 100) / 100;
            
            // Create order in database using correct schema
            const orderSql = 'INSERT INTO orders (orderId, userId, subtotal, tax, total, orderDate, paymentProvider, paymentReference, seller_earnings, admin_commission) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const orderDate = new Date();
            const subtotalValue = subtotal - discount;
            
            connection.query(orderSql, [orderId, userId, subtotalValue, tax, total, orderDate, 'Wallet', transaction.id, sellerEarnings, adminCommission], (orderErr, orderResult) => {
                if (orderErr) {
                    console.error('Error creating order:', orderErr);
                    // Refund the wallet
                    Wallet.deposit(userId, total, 'Refund - Order creation failed', null, () => {});
                    req.flash('error', 'Error creating order. Your wallet has been refunded.');
                    return res.redirect('/payment');
                }
                
                // Increment discount usage if applicable
                if (appliedDiscount && appliedDiscount.id) {
                    const DiscountCode = require('./models/DiscountCode');
                    DiscountCode.incrementUsage(appliedDiscount.id, (discErr) => {
                        if (discErr) console.error('Error incrementing discount usage:', discErr);
                    });
                }
                
                // Insert order items using correct schema
                const itemsSql = 'INSERT INTO order_items (orderId, productId, productName, quantity, price) VALUES ?';
                const itemsValues = cart.map(item => [orderId, item.id, item.productName, item.quantity, item.price]);
                
                connection.query(itemsSql, [itemsValues], (itemsErr) => {
                    if (itemsErr) {
                        console.error('Error saving order items:', itemsErr);
                        req.flash('error', 'Error processing order. Please contact support.');
                        return res.redirect('/payment');
                    }
                    
                    // Delete sold vehicles from inventory (car dealership - each vehicle is unique)
                    const updatePromises = cart.map(item => {
                        return new Promise((resolve, reject) => {
                            const deleteQuery = 'DELETE FROM products WHERE id = ?';
                            connection.query(deleteQuery, [item.id], (deleteErr) => {
                                if (deleteErr) return reject(deleteErr);
                                resolve();
                            });
                        });
                    });
                    
                    Promise.all(updatePromises)
                        .then(async () => {
                            // Send email notification (non-blocking, don't wait for it)
                            try {
                                const emailService = require('./utils/emailService');
                                emailService.sendEReceipt(
                                    req.session.user.email,
                                    orderId,
                                    cart,
                                    subtotalValue,
                                    tax,
                                    total
                                ).catch(emailErr => {
                                    console.error('Error sending confirmation email:', emailErr);
                                });
                            } catch (emailErr) {
                                console.error('Error loading email service:', emailErr);
                            }
                            
                            // Clear cart and redirect
                            req.session.cart = [];
                            req.session.appliedDiscount = null;
                            
                            req.flash('success', `Payment successful! Order #${orderId} has been placed.`);
                            res.redirect(`/payment/success?orderId=${orderId}&method=Wallet`);
                        })
                        .catch(updateErr => {
                            console.error('Error updating product stock:', updateErr);
                            req.flash('error', 'Error processing order. Please contact support.');
                            res.redirect('/payment');
                        });
                });
            });
        });
    });
});

// ======= Routes for fines feature (from StudentFinesApp) =======
app.get('/fines', checkAuthenticated, checkAdmin, FinesController.list);
app.post('/fines/pay', checkAuthenticated, FinesController.pay);
app.get('/admin/fine-user', checkAuthenticated, checkAdmin, FinesController.showFineUserForm);
app.post('/admin/fine-user', checkAuthenticated, checkAdmin, FinesController.fineUser);
app.get('/admin/dashboard', checkAuthenticated, checkAdmin, FinesController.adminDashboard);

// Admin seller management routes
app.get('/admin/sellers', checkAuthenticated, checkAdmin, AdminSellerController.index);
app.post('/admin/sellers/:id/approve', checkAuthenticated, checkAdmin, AdminSellerController.approve);
app.post('/admin/sellers/:id/reject', checkAuthenticated, checkAdmin, AdminSellerController.reject);
app.post('/admin/sellers/:id/suspend', checkAuthenticated, checkAdmin, AdminSellerController.suspend);
app.post('/admin/sellers/:id/reactivate', checkAuthenticated, checkAdmin, AdminSellerController.reactivate);

// Seller dashboard routes
app.get('/seller/dashboard', checkAuthenticated, checkSeller, SellerController.dashboard);
app.get('/seller/add-vehicle', checkAuthenticated, checkSeller, SellerController.showAddVehicleForm);
app.post('/seller/add-vehicle', checkAuthenticated, checkSeller, upload.single('image'), SellerController.addVehicle);
app.post('/seller/update-profile', checkAuthenticated, checkSeller, SellerController.updateProfile);
app.post('/seller/vehicle/:id/delete', checkAuthenticated, checkSeller, SellerController.deleteVehicle);
app.post('/seller/vehicle/:id/mark-sold', checkAuthenticated, checkSeller, SellerController.markAsSold);

// Admin user management routes
app.post('/admin/toggle-role', checkAuthenticated, checkAdmin, (req, res) => {
    const { userId, currentRole } = req.body;
    
    // Prevent admin from removing their own admin role
    if (parseInt(userId) === req.session.user.userId) {
        req.flash('error', 'You cannot change your own role');
        return res.redirect('/admin/dashboard');
    }
    
    // Toggle between admin and user roles
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    connection.query('UPDATE users SET role = ? WHERE id = ?', [newRole, userId], (error, results) => {
        if (error) {
            console.error('Error updating user role:', error);
            req.flash('error', 'Failed to update user role');
        } else {
            req.flash('success', `User role updated to ${newRole} successfully`);
        }
        res.redirect('/admin/dashboard');
    });
});

app.post('/admin/delete-user', checkAuthenticated, checkAdmin, (req, res) => {
    const { userId } = req.body;
    
    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.session.user.userId) {
        req.flash('error', 'You cannot delete your own account');
        return res.redirect('/admin/dashboard');
    }
    
    // First get user info for confirmation message
    connection.query('SELECT username FROM users WHERE id = ?', [userId], (error, results) => {
        if (error || results.length === 0) {
            console.error('Error fetching user:', error);
            req.flash('error', 'User not found');
            return res.redirect('/admin/dashboard');
        }
        
        const username = results[0].username;
        
        // Delete the user
        connection.query('DELETE FROM users WHERE id = ?', [userId], (deleteError, deleteResults) => {
            if (deleteError) {
                console.error('Error deleting user:', deleteError);
                req.flash('error', 'Failed to delete user');
            } else {
                req.flash('success', `User "${username}" has been deleted successfully`);
            }
            res.redirect('/admin/dashboard');
        });
    });
});

// fines cart API endpoints (namespaced to avoid colliding with product cart)
app.post('/fines/cart/add', checkAuthenticated, CartItemsController.add);
app.post('/fines/cart/remove', checkAuthenticated, CartItemsController.remove);
app.post('/fines/cart/clear', checkAuthenticated, CartItemsController.clear);
app.get('/fines/cart', checkAuthenticated, CartItemsController.list);

// ======= Support/Feedback System Routes =======
// Delete support ticket (user or admin)
app.post('/support/delete', checkAuthenticated, (req, res) => {
    const ticketId = req.body.ticketId;
    const userId = req.session.user.userId;
    const isAdmin = req.session.user.role === 'admin';

    // Only allow delete if admin or ticket owner
    connection.query('SELECT userId FROM support_tickets WHERE id = ?', [ticketId], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'Ticket not found');
            return isAdmin ? res.redirect('/admin/support') : res.redirect('/support');
        }
        const ownerId = results[0].userId;
        if (isAdmin || ownerId === userId) {
            connection.query('DELETE FROM support_tickets WHERE id = ?', [ticketId], (delErr) => {
                if (delErr) {
                    req.flash('error', 'Failed to delete ticket');
                } else {
                    req.flash('success', 'Support ticket deleted successfully');
                }
                return isAdmin ? res.redirect('/admin/support') : res.redirect('/support');
            });
        } else {
            req.flash('error', 'You do not have permission to delete this ticket');
            return res.redirect('/support');
        }
    });
});
// User support page
app.get('/support', checkAuthenticated, (req, res) => {
    const userId = req.session.user.userId;
    
    // Get user's support tickets
    connection.query(
        'SELECT * FROM support_tickets WHERE userId = ? ORDER BY created_at DESC',
        [userId],
        (error, tickets) => {
            if (error) {
                console.error('Error fetching support tickets:', error);
                tickets = [];
            }
            res.render('support/user', {
                user: req.session.user,
                tickets: tickets || [],
                messages: { error: req.flash('error'), success: req.flash('success') }
            });
        }
    );
});

// Submit support ticket
app.post('/support/submit', checkAuthenticated, (req, res) => {
    const { subject, message, priority } = req.body;
    const userId = req.session.user.userId;
    const username = req.session.user.name;
    const email = req.session.user.email;
    
    if (!subject || !message || !priority) {
        req.flash('error', 'All fields are required');
        return res.redirect('/support');
    }
    
    const sql = 'INSERT INTO support_tickets (userId, username, email, subject, message, priority) VALUES (?, ?, ?, ?, ?, ?)';
    connection.query(sql, [userId, username, email, subject, message, priority], (error, results) => {
        if (error) {
            console.error('Error submitting support ticket:', error);
            req.flash('error', 'Failed to submit support ticket');
        } else {
            req.flash('success', 'Support ticket submitted successfully! We will respond soon.');
        }
        res.redirect('/support');
    });
});

// ======= Refund Management Routes =======
// Admin view all orders for refund management
app.get('/admin/refunds', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = `
        SELECT o.orderId, o.userId, o.subtotal, o.tax, o.total, o.orderDate,
               o.refundedAmount, o.refundStatus, o.paymentProvider, o.paymentReference,
               u.username as userName, u.email as userEmail,
               oi.productId, oi.productName, oi.quantity, oi.price
        FROM orders o
        LEFT JOIN users u ON o.userId = u.id
        LEFT JOIN order_items oi ON o.orderId = oi.orderId
        ORDER BY o.orderDate DESC
    `;
    
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching orders for refunds:', err);
            req.flash('error', 'Error loading orders');
            return res.redirect('/admin/dashboard');
        }
        
        // Group items by orderId
        const ordersMap = {};
        results.forEach(row => {
            if (!ordersMap[row.orderId]) {
                ordersMap[row.orderId] = {
                    orderId: row.orderId,
                    userId: row.userId,
                    userName: row.userName,
                    userEmail: row.userEmail,
                    subtotal: parseFloat(row.subtotal),
                    tax: parseFloat(row.tax),
                    total: parseFloat(row.total),
                    orderDate: row.orderDate,
                    refundedAmount: parseFloat(row.refundedAmount) || 0,
                    refundStatus: row.refundStatus || 'none',
                    paymentProvider: row.paymentProvider,
                    paymentReference: row.paymentReference,
                    items: []
                };
            }
            if (row.productId) {
                ordersMap[row.orderId].items.push({
                    id: row.productId,
                    productName: row.productName,
                    quantity: row.quantity,
                    price: parseFloat(row.price)
                });
            }
        });
        
        const orders = Object.values(ordersMap);
        res.render('admin/refunds', { 
            orders, 
            user: req.session.user,
            messages: { error: req.flash('error'), success: req.flash('success') }
        });
    });
});

// Process refund
app.post('/admin/refunds/process', checkAuthenticated, checkAdmin, (req, res) => {
    // Admin is no longer allowed to process refunds
    // Only sellers can process refunds for their own products
    req.flash('error', 'Admin cannot process refunds. Only sellers can manage refunds for their products. Please contact the seller directly.');
    res.redirect('/admin/refunds');
});

// Admin view all support tickets
app.get('/admin/support', checkAuthenticated, checkAdmin, (req, res) => {
    // Get all support tickets
    connection.query(
        'SELECT * FROM support_tickets ORDER BY created_at DESC',
        (error, tickets) => {
            if (error) {
                console.error('Error fetching support tickets:', error);
                return res.status(500).send('Error fetching support tickets');
            }
            
            // Calculate statistics
            const stats = {
                total: tickets.length,
                open: tickets.filter(t => t.status === 'open').length,
                inProgress: tickets.filter(t => t.status === 'in-progress').length,
                resolved: tickets.filter(t => t.status === 'resolved').length
            };
            
            res.render('support/admin', {
                user: req.session.user,
                tickets: tickets || [],
                stats: stats,
                messages: { error: req.flash('error'), success: req.flash('success') }
            });
        }
    );
});

// Admin respond to support ticket
app.post('/admin/support/respond', checkAuthenticated, checkAdmin, (req, res) => {
    const { ticketId, response, status } = req.body;
    
    let sql, params;
    if (response && response.trim()) {
        // Update both response and status
        sql = 'UPDATE support_tickets SET admin_response = ?, status = ?, updated_at = NOW() WHERE id = ?';
        params = [response.trim(), status, ticketId];
    } else {
        // Update only status
        sql = 'UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?';
        params = [status, ticketId];
    }
    
    connection.query(sql, params, (error, results) => {
        if (error) {
            console.error('Error updating support ticket:', error);
            req.flash('error', 'Failed to update support ticket');
        } else {
            req.flash('success', 'Support ticket updated successfully');
        }
        res.redirect('/admin/support');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ======= Payment Analytics Dashboard =======
app.get('/admin/analytics', checkAuthenticated, checkAdmin, async (req, res) => {
    const period = req.query.period || '30'; // Default to last 30 days
    const daysAgo = parseInt(period);
    
    try {
        // Get total revenue and order stats
        const statsQuery = `
            SELECT 
                COUNT(*) as totalOrders,
                COALESCE(SUM(total - COALESCE(refundedAmount, 0)), 0) as totalRevenue,
                COALESCE(SUM(COALESCE(admin_commission, 0) - (COALESCE(refundedAmount, 0) * 0.10)), 0) as totalAdminCommission,
                COALESCE(AVG(total - COALESCE(refundedAmount, 0)), 0) as avgOrderValue,
                COUNT(CASE WHEN refundStatus = 'full' THEN 1 END) as fullyRefundedOrders
            FROM orders 
            WHERE orderDate >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        
        const stats = await new Promise((resolve, reject) => {
            connection.query(statsQuery, [daysAgo], (err, results) => {
                if (err) {
                    console.error('Analytics query error:', err);
                    reject(err);
                } else {
                    const result = results[0];
                    // Convert to proper numeric types
                    // If admin_commission column exists and has data, use it; otherwise calculate 10% of total
                    const totalRevenue = parseFloat(result.totalRevenue) || 0;
                    const totalAdminCommission = parseFloat(result.totalAdminCommission) || 0;
                    const adminCommission = totalAdminCommission > 0 ? totalAdminCommission : (totalRevenue * 0.10);
                    
                    // Count orders excluding fully refunded ones
                    const totalOrders = parseInt(result.totalOrders) || 0;
                    const fullyRefundedOrders = parseInt(result.fullyRefundedOrders) || 0;
                    const actualOrders = totalOrders - fullyRefundedOrders;
                    
                    resolve({
                        totalOrders: actualOrders,
                        totalRevenue: totalRevenue,
                        adminCommission: adminCommission,
                        avgOrderValue: actualOrders > 0 ? (totalRevenue / actualOrders) : 0
                    });
                }
            });
        });
        
        // Calculate success rate (assuming all orders in DB are successful)
        stats.successRate = 100; // Can be adjusted based on your tracking
        
        // Get daily revenue data for chart
        const revenueQuery = `
            SELECT 
                DATE(orderDate) as date,
                COALESCE(SUM(total - COALESCE(refundedAmount, 0)), 0) as revenue
            FROM orders
            WHERE orderDate >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(orderDate)
            ORDER BY date ASC
        `;
        
        const revenueByDay = await new Promise((resolve, reject) => {
            connection.query(revenueQuery, [daysAgo], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
        
        // Format revenue data for chart
        const revenueData = {
            labels: revenueByDay.map(row => new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            values: revenueByDay.map(row => parseFloat(row.revenue))
        };
        
        // Get payment method breakdown
        const paymentMethodQuery = `
            SELECT 
                paymentProvider as provider,
                COUNT(*) as count,
                COALESCE(SUM(total - COALESCE(refundedAmount, 0)), 0) as totalAmount,
                COALESCE(AVG(total - COALESCE(refundedAmount, 0)), 0) as avgAmount,
                100 as successRate
            FROM orders
            WHERE orderDate >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY paymentProvider
            ORDER BY totalAmount DESC
        `;
        
        const paymentMethods = await new Promise((resolve, reject) => {
            connection.query(paymentMethodQuery, [daysAgo], (err, results) => {
                if (err) reject(err);
                else resolve(results.map(row => ({
                    ...row,
                    totalAmount: parseFloat(row.totalAmount),
                    avgAmount: parseFloat(row.avgAmount)
                })));
            });
        });
        
        // Format payment method data for pie chart
        const paymentMethodData = {
            labels: paymentMethods.map(m => m.provider),
            values: paymentMethods.map(m => m.count)
        };
        
        // Get top customers by spending
        const topCustomersQuery = `
            SELECT 
                u.username as name,
                u.email,
                COUNT(o.orderId) as orderCount,
                COALESCE(SUM(o.total), 0) as totalSpent
            FROM users u
            JOIN orders o ON u.id = o.userId
            WHERE o.orderDate >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY u.id, u.username, u.email
            ORDER BY totalSpent DESC
            LIMIT 10
        `;
        
        const topCustomers = await new Promise((resolve, reject) => {
            connection.query(topCustomersQuery, [daysAgo], (err, results) => {
                if (err) reject(err);
                else resolve(results.map(row => ({
                    ...row,
                    totalSpent: parseFloat(row.totalSpent)
                })));
            });
        });
        
        // Get popular discount codes
        const discountCodesQuery = `
            SELECT 
                code,
                type as discountType,
                value as discountValue,
                usedCount as timesUsed,
                CASE 
                    WHEN type = 'percentage' THEN NULL
                    ELSE value * usedCount
                END as totalSavings
            FROM discount_codes
            WHERE usedCount > 0
            ORDER BY usedCount DESC
            LIMIT 10
        `;
        
        const discountCodes = await new Promise((resolve, reject) => {
            connection.query(discountCodesQuery, [], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
        
        res.render('admin/analytics', {
            user: req.session.user,
            period: period,
            stats: stats,
            revenueData: revenueData,
            paymentMethodData: paymentMethodData,
            paymentMethods: paymentMethods,
            topCustomers: topCustomers,
            discountCodes: discountCodes,
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        });
        
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        req.flash('error', 'Error loading analytics dashboard');
        res.redirect('/admin/dashboard');
    }
});

// ======= Admin Discount Code Management Routes =======
// Display discount code management page
app.get('/admin/discount-codes', checkAuthenticated, checkAdmin, async (req, res) => {
    try {
        const discountCodes = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM discount_codes ORDER BY createdAt DESC',
                [],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });

        res.render('admin/discount-codes', {
            user: req.session.user,
            discountCodes: discountCodes,
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        });
    } catch (error) {
        console.error('Error loading discount codes:', error);
        req.flash('error', 'Error loading discount codes');
        res.redirect('/admin/dashboard');
    }
});

// Create new discount code
app.post('/admin/discount-codes/create', checkAuthenticated, checkAdmin, (req, res) => {
    const { code, type, value, minPurchase, maxUses, expiryDate, active } = req.body;

    // Validate required fields
    if (!code || !type || !value) {
        req.flash('error', 'Code, type, and value are required fields');
        return res.redirect('/admin/discount-codes');
    }

    // Validate code format (uppercase letters and numbers only)
    if (!/^[A-Z0-9]+$/.test(code)) {
        req.flash('error', 'Code must contain only uppercase letters and numbers');
        return res.redirect('/admin/discount-codes');
    }

    // Validate value
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
        req.flash('error', 'Value must be a positive number');
        return res.redirect('/admin/discount-codes');
    }

    // Validate percentage type
    if (type === 'percentage' && numValue > 100) {
        req.flash('error', 'Percentage discount cannot exceed 100%');
        return res.redirect('/admin/discount-codes');
    }

    // Check if code already exists
    connection.query(
        'SELECT id FROM discount_codes WHERE code = ?',
        [code.toUpperCase()],
        (err, results) => {
            if (err) {
                console.error('Error checking discount code:', err);
                req.flash('error', 'Error creating discount code');
                return res.redirect('/admin/discount-codes');
            }

            if (results.length > 0) {
                req.flash('error', 'A discount code with this name already exists');
                return res.redirect('/admin/discount-codes');
            }

            // Create the discount code
            const insertData = {
                code: code.toUpperCase(),
                type: type,
                value: numValue,
                minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
                maxUses: maxUses ? parseInt(maxUses) : null,
                expiryDate: expiryDate || null,
                active: active === 'on' ? 1 : 0,
                usedCount: 0
            };

            connection.query(
                'INSERT INTO discount_codes SET ?',
                insertData,
                (err, result) => {
                    if (err) {
                        console.error('Error creating discount code:', err);
                        req.flash('error', 'Error creating discount code');
                        return res.redirect('/admin/discount-codes');
                    }

                    req.flash('success', `Discount code "${code.toUpperCase()}" created successfully!`);
                    res.redirect('/admin/discount-codes');
                }
            );
        }
    );
});

// Delete discount code
app.post('/admin/discount-codes/delete', checkAuthenticated, checkAdmin, (req, res) => {
    const { codeId } = req.body;

    if (!codeId) {
        req.flash('error', 'Invalid discount code ID');
        return res.redirect('/admin/discount-codes');
    }

    connection.query(
        'DELETE FROM discount_codes WHERE id = ?',
        [codeId],
        (err, result) => {
            if (err) {
                console.error('Error deleting discount code:', err);
                req.flash('error', 'Error deleting discount code');
                return res.redirect('/admin/discount-codes');
            }

            if (result.affectedRows === 0) {
                req.flash('error', 'Discount code not found');
            } else {
                req.flash('success', 'Discount code deleted successfully');
            }

            res.redirect('/admin/discount-codes');
        }
    );
});

// ======= Chatbot API Routes =======
// AI-powered chatbot endpoint
app.post('/api/chatbot', (req, res) => ChatbotController.chat(req, res));

// Clear chatbot conversation history
app.post('/api/chatbot/clear', (req, res) => ChatbotController.clearHistory(req, res));

// ======= Discount Code Routes =======
// Validate discount code
app.post('/api/discount/validate', checkAuthenticated, (req, res) => {
    const { code } = req.body;
    const cart = req.session.cart || [];
    
    if (!code || code.trim() === '') {
        return res.status(400).json({ success: false, error: 'Please enter a discount code' });
    }
    
    if (cart.length === 0) {
        return res.status(400).json({ success: false, error: 'Cart is empty' });
    }
    
    // Calculate cart subtotal
    let subtotal = 0;
    for (let item of cart) {
        subtotal += item.price * item.quantity;
    }
    
    DiscountCode.validate(code.trim(), subtotal, (err, discount) => {
        if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        
        // Calculate discount amount
        const discountAmount = DiscountCode.calculateDiscount(discount, subtotal);
        const discountedSubtotal = subtotal - discountAmount;
        const tax = discountedSubtotal * 0.1;
        const total = discountedSubtotal + tax;
        
        // Store discount in session
        req.session.appliedDiscount = {
            id: discount.id,
            code: discount.code,
            type: discount.type,
            value: discount.value,
            amount: discountAmount
        };
        
        res.json({
            success: true,
            discount: {
                code: discount.code,
                type: discount.type,
                value: discount.value,
                amount: discountAmount.toFixed(2)
            },
            totals: {
                subtotal: subtotal.toFixed(2),
                discount: discountAmount.toFixed(2),
                tax: tax.toFixed(2),
                total: total.toFixed(2)
            }
        });
    });
});

// Remove discount code
app.post('/api/discount/remove', checkAuthenticated, (req, res) => {
    delete req.session.appliedDiscount;
    
    const cart = req.session.cart || [];
    let subtotal = 0;
    for (let item of cart) {
        subtotal += item.price * item.quantity;
    }
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    
    res.json({
        success: true,
        totals: {
            subtotal: subtotal.toFixed(2),
            discount: '0.00',
            tax: tax.toFixed(2),
            total: total.toFixed(2)
        }
    });
});

app.get('/product/:id', checkAuthenticated, (req, res) => {
  // Extract the product ID from the request parameters
  const productId = req.params.id;

  // Fetch data from MySQL based on the product ID
  connection.query('SELECT * FROM products WHERE id = ?', [productId], (error, results) => {
      if (error) throw error;

      // Check if any product with the given ID was found
      if (results.length > 0) {
          const product = results[0];
          console.log('Product found:', { id: product.id, name: product.productName, seller_id: product.seller_id });
          
          // Track vehicle view if product has a seller
          if (product.seller_id) {
              const viewerIp = req.ip || req.connection.remoteAddress;
              const userAgent = req.get('user-agent') || '';
              const viewerId = req.session.user ? req.session.user.userId : null;
              
              console.log('Tracking view:', { vehicleId: productId, sellerId: product.seller_id, viewerId: viewerId, ip: viewerIp });
              
              const viewSql = `
                  INSERT INTO vehicle_views (vehicle_id, seller_id, viewer_id, visitor_ip, visitor_user_agent, viewed_at)
                  VALUES (?, ?, ?, ?, ?, NOW())
              `;
              
              connection.query(viewSql, [productId, product.seller_id, viewerId, viewerIp, userAgent], (viewErr) => {
                  if (viewErr) {
                      console.error('Error tracking vehicle view:', viewErr);
                  } else {
                      console.log('View tracked successfully for product:', productId);
                  }
              });
              
              // Increment views counter on the products table
              connection.query('UPDATE products SET views = views + 1 WHERE id = ?', [productId], (updateErr) => {
                  if (updateErr) {
                      console.error('Error incrementing views:', updateErr);
                  } else {
                      console.log('Views incremented for product:', productId);
                  }
              });
              
              // Fetch seller information
              connection.query('SELECT id, username, email, seller_status FROM users WHERE id = ?', [product.seller_id], (sellerErr, sellerResults) => {
                  if (sellerErr) {
                      console.error('Error fetching seller info:', sellerErr);
                  } else if (sellerResults.length > 0) {
                      product.username = sellerResults[0].username;
                      product.seller_email = sellerResults[0].email;
                      product.seller_status = sellerResults[0].seller_status;
                      console.log('Seller info found:', sellerResults[0].username);
                  }
                  
                  // Render HTML page with the product data
                  res.render('products/show', { product: product, user: req.session.user });
              });
          } else {
              console.log('No seller_id for this product - it may be a legacy product');
              // Render HTML page with the product data (no seller info needed)
              res.render('products/show', { product: product, user: req.session.user });
          }
      } else {
          // If no product with the given ID was found, render a 404 page or handle it accordingly
          res.status(404).send('Product not found');
      }
  });
});

app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('products/add', {user: req.session.user } ); 
});

app.post('/addProduct', upload.single('image'),  (req, res) => {
    // Extract product data from the request body
    const { name, quantity, price, category} = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO products (productName, quantity, price, image, category) VALUES (?, ?, ?, ?, ?)';
    // Insert the new product into the database
    connection.query(sql , [name, quantity, price, image, category || null], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding product:", error);
            res.status(500).send('Error adding product');
        } else {
            // Send a success response
            res.redirect('/inventory');
        }
    });
});

app.get('/updateProduct/:id',checkAuthenticated, checkAdmin, (req,res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE id = ?';

    // Fetch data from MySQL based on the product ID
    connection.query(sql , [productId], (error, results) => {
        if (error) throw error;

        // Check if any product with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the product data
            res.render('products/edit', { product: results[0] });
        } else {
            // If no product with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('Product not found');
        }
    });
});

app.post('/updateProduct/:id', upload.single('image'), (req, res) => {
    const productId = req.params.id;
    // Extract product data from the request body
    const { name, quantity, price, category } = req.body;
    let image  = req.body.currentImage; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    } 

    const sql = 'UPDATE products SET productName = ? , quantity = ?, price = ?, image =?, category = ? WHERE id = ?';
    // Insert the new product into the database
    connection.query(sql, [name, quantity, price, image, category || null, productId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error updating product:", error);
            res.status(500).send('Error updating product');
        } else {
            // Send a success response
            res.redirect('/inventory');
        }
    });
});

// Show delete reason form
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const productId = req.params.id;

    connection.query('SELECT * FROM products WHERE id = ?', [productId], (error, results) => {
        if (error) {
            console.error("Error fetching product:", error);
            req.flash('error', 'Error loading product');
            return res.redirect('/inventory');
        }
        if (!results || results.length === 0) {
            req.flash('error', 'Product not found');
            return res.redirect('/inventory');
        }
        res.render('admin/deleteReasonForm', {
            product: results[0],
            user: req.session.user
        });
    });
});

// Process delete with reason
app.post('/deleteProduct/:id/confirm', checkAuthenticated, checkAdmin, (req, res) => {
    const productId = req.params.id;
    const { reason, details } = req.body;

    if (!reason) {
        req.flash('error', 'Please provide a reason for deletion');
        return res.redirect(`/deleteProduct/${productId}`);
    }

    // Log the deletion with reason
    const logSql = `
        INSERT INTO product_deletion_log (product_id, deleted_by_admin, deletion_reason, deletion_details, deleted_at)
        VALUES (?, ?, ?, ?, NOW())
    `;

    connection.query(logSql, [productId, req.session.user.userId, reason, details || null], (logError) => {
        if (logError) {
            console.error('Error logging deletion:', logError);
            // Continue with deletion even if logging fails
        }

        // Now delete the product
        connection.query('DELETE FROM products WHERE id = ?', [productId], (error, results) => {
            if (error) {
                console.error("Error deleting product:", error);
                req.flash('error', 'Error deleting product');
                return res.redirect('/inventory');
            }
            req.flash('success', 'Product deleted successfully');
            res.redirect('/inventory');
        });
    });
});

// ======= NETS Payment Routes =======
// Generate NETS QR Code
app.post('/generateNETSQR', checkAuthenticated, netsQr.generateQrCode);

// ======= PayPal Payment Routes =======
// PayPal: Create Order
app.post('/api/paypal/create-order', checkAuthenticated, async (req, res) => {
  try {
    const { amount, currency = 'SGD' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    console.log(`PayPal: Creating order for ${amount} ${currency}`);
    
    const order = await paypal.createOrder(amount, currency, { description: 'Purchase' });
    
    console.log('PayPal order response:', order);
    
    if (order && order.id) {
      const orderCurrency = order.purchase_units && order.purchase_units[0] 
        ? order.purchase_units[0].amount.currency_code 
        : currency;
      res.json({ id: order.id, currency: orderCurrency });
    } else {
      console.error('PayPal order creation failed:', order);
      res.status(500).json({ error: 'Failed to create PayPal order', details: order });
    }
  } catch (err) {
    console.error('PayPal create order error:', err);
    res.status(500).json({ error: 'Failed to create PayPal order', message: err.message });
  }
});

// PayPal: Capture Order
app.post('/api/paypal/capture-order', checkAuthenticated, async (req, res) => {
  try {
    const { orderID } = req.body;
    const capture = await paypal.captureOrder(orderID);
    console.log('PayPal captureOrder response:', capture);

    if (capture.status === "COMPLETED") {
      // Process the order after successful payment
      const cart = req.session.cart || [];
      if (cart.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      // Calculate totals with discount
      let subtotal = 0;
      for (let item of cart) {
        subtotal += item.price * item.quantity;
      }
      
      const appliedDiscount = req.session.appliedDiscount || null;
      let discountAmount = 0;
      if (appliedDiscount) {
        discountAmount = appliedDiscount.amount;
      }
      
      const taxableAmount = subtotal - discountAmount;
      const tax = taxableAmount * 0.1;
      const total = taxableAmount + tax;

      // Check wallet balance and calculate wallet usage
      Wallet.getBalance(req.session.user.userId, async (walletErr, walletBalance) => {
        if (walletErr) {
          console.error('Error getting wallet balance:', walletErr);
          walletBalance = 0;
        }
        
        const walletUsage = Math.min(walletBalance, total);

      // Use a pooled connection and run a transaction
      connection.getConnection((getErr, conn) => {
        if (getErr) {
          console.error('Could not get DB connection from pool:', getErr);
          return res.status(500).json({ error: 'Database error' });
        }

        conn.beginTransaction((txErr) => {
          if (txErr) {
            console.error('Could not start transaction:', txErr);
            conn.release();
            return res.status(500).json({ error: 'Transaction error' });
          }

          // Process items sequentially
          let idx = 0;
          const failures = [];

          function processNext() {
            if (idx >= cart.length) {
              // All updates attempted
              if (failures.length > 0) {
                // rollback
                return conn.rollback(() => {
                  conn.release();
                  return res.status(400).json({ error: failures.join('; ') });
                });
              }

              // commit
              return conn.commit((commitErr) => {
                if (commitErr) {
                  console.error('Commit error:', commitErr);
                  return conn.rollback(() => {
                    conn.release();
                    return res.status(500).json({ error: 'Server error during order processing' });
                  });
                }

                // Extract the actual capture ID from PayPal response
                const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || capture.id || orderID;
                
                // Store order details and clear cart
                const orderId = 'ORD-' + Date.now();
                req.session.lastOrder = {
                  items: cart,
                  subtotal: taxableAmount,
                  discount: discountAmount,
                  discountCode: appliedDiscount ? appliedDiscount.code : null,
                  tax: tax,
                  total: total,
                  orderDate: new Date(),
                  orderId: orderId,
                  paymentMethod: 'PayPal',
                  txnRef: captureId
                };
                
                // Increment discount usage if applicable
                if (appliedDiscount && appliedDiscount.id) {
                  DiscountCode.incrementUsage(appliedDiscount.id, (discErr) => {
                    if (discErr) console.error('Error incrementing discount usage:', discErr);
                  });
                }
                
                // Calculate 90/10 split: 90% to seller, 10% to admin
                const sellerEarnings = Math.round(total * 0.90 * 100) / 100;
                const adminCommission = Math.round(total * 0.10 * 100) / 100;
                
                // Save order to database
                const orderSql = 'INSERT INTO orders (orderId, userId, subtotal, tax, total, orderDate, paymentProvider, paymentReference, seller_earnings, admin_commission) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                conn.query(orderSql, [orderId, req.session.user.userId, taxableAmount, tax, total, new Date(), 'PayPal', captureId, sellerEarnings, adminCommission], (orderErr) => {
                  if (orderErr) {
                    console.error('Error saving order:', orderErr);
                  } else {
                    // Save order items
                    const itemsSql = 'INSERT INTO order_items (orderId, productId, productName, quantity, price) VALUES ?';
                    const itemsValues = cart.map(item => [orderId, item.id, item.productName, item.quantity, item.price]);
                    conn.query(itemsSql, [itemsValues], (itemsErr) => {
                      if (itemsErr) {
                        console.error('Error saving order items:', itemsErr);
                      }
                    });
                  }
                });
                
                // keep a per-session history of orders
                if (!req.session.orders) req.session.orders = [];
                req.session.orders.push(req.session.lastOrder);
                req.session.cart = [];
                delete req.session.appliedDiscount; // Clear discount
                conn.release();
                
                // Send email receipt
                const userEmail = req.session.user.email;
                emailService.sendEReceipt(userEmail, orderId, cart, taxableAmount, tax, total)
                  .then(result => {
                    if (result.success) {
                      console.log('Receipt sent successfully to:', userEmail);
                    } else {
                      console.error('Failed to send receipt:', result.message);
                    }
                  })
                  .catch(error => {
                    console.error('Error sending receipt:', error);
                  });
                
                res.json({ 
                  success: true,
                  status: 'COMPLETED',
                  orderId: orderId,
                  redirectUrl: '/paypal/success?orderId=' + orderId,
                  message: 'Payment successful! Your order has been placed.'
                });
              });
            }

            const item = cart[idx];
            // safe update: only decrement if enough stock remains
            const sql = 'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?';
            conn.query(sql, [item.quantity, item.id, item.quantity], (err, result) => {
              if (err) {
                console.error('Error updating product stock:', err);
                failures.push('Server error updating stock');
                idx++;
                return processNext();
              }

              if (result.affectedRows === 0) {
                // fetch current quantity and product name to provide helpful message
                conn.query('SELECT productName, quantity FROM products WHERE id = ?', [item.id], (qErr, rows) => {
                  if (qErr) {
                    console.error('Error fetching product info:', qErr);
                    failures.push(`Insufficient stock for an item (could not read availability)`);
                  } else if (rows.length > 0) {
                    const row = rows[0];
                    failures.push(`${row.productName} has only ${row.quantity} available`);
                  } else {
                    failures.push('An item in your cart is no longer available');
                  }
                  idx++;
                  processNext();
                });
              } else {
                idx++;
                processNext();
              }
            });
          }

          processNext();
        });
      });
      }); // Close Wallet.getBalance callback
    } else {
      res.status(400).json({ 
        error: 'Payment not completed', 
        redirectUrl: '/paypal/fail',
        details: capture 
      });
    }
  } catch (err) {
    console.error('PayPal capture order error:', err);
    res.status(500).json({ 
      error: 'Failed to capture PayPal order', 
      redirectUrl: '/paypal/fail',
      message: err.message 
    });
  }
});

// ======= Stripe Payment Routes =======
// Stripe: Create Payment Intent
app.post('/api/stripe/create-payment-intent', checkAuthenticated, async (req, res) => {
  try {
    const { amount, currency = 'sgd' } = req.body;
    const result = await stripeService.createPaymentIntent(amount, currency);
    
    if (result.success) {
      res.json({
        success: true,
        clientSecret: result.clientSecret,
        id: result.id,
        currency: result.currency,
        amount: result.amount
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create payment intent',
        details: result.error
      });
    }
  } catch (err) {
    console.error('Stripe create payment intent error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent',
      message: err.message
    });
  }
});

// Stripe: Confirm Payment (after successful payment on client side)
app.post('/api/stripe/confirm-payment', checkAuthenticated, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const result = await stripeService.retrievePaymentIntent(paymentIntentId);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment intent',
        details: result.error
      });
    }
    
    const paymentIntent = result.paymentIntent;
    console.log('Stripe Payment Intent status:', paymentIntent.status);
    
    if (paymentIntent.status === 'succeeded') {
      // Check if this is a gift card purchase
      if (paymentIntent.metadata && paymentIntent.metadata.purchaseType === 'giftcard') {
        if (!req.session.giftCardPurchase) {
          return res.json({ success: false, error: 'No gift card purchase in progress' });
        }
        
        GiftCardController.finalizeGiftCardPurchase(req, res, 'stripe', paymentIntentId, true);
        return;
      }
      
      // Check if this is a wallet topup
      if (paymentIntent.metadata && paymentIntent.metadata.type === 'wallet_topup') {
        const amount = paymentIntent.amount / 100; // Convert from cents
        
        Wallet.deposit(
          req.session.user.userId,
          amount,
          'Wallet top-up via Stripe',
          paymentIntentId,
          (err, newBalance) => {
            if (err) {
              console.error('Error adding wallet funds:', err);
              return res.json({ success: false, error: 'Failed to add funds' });
            }
            return res.json({ 
              success: true, 
              redirectUrl: `/wallet/topup/success?amount=${amount.toFixed(2)}`
            });
          }
        );
        return;
      }
      
      // Process regular order after successful payment
      const cart = req.session.cart || [];
      if (cart.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      // Calculate totals with discount
      let subtotal = 0;
      for (let item of cart) {
        subtotal += item.price * item.quantity;
      }
      
      const appliedDiscount = req.session.appliedDiscount || null;
      let discountAmount = 0;
      if (appliedDiscount) {
        discountAmount = appliedDiscount.amount;
      }
      
      const taxableAmount = subtotal - discountAmount;
      const tax = taxableAmount * 0.1;
      const total = taxableAmount + tax;

      // Use a pooled connection and run a transaction
      connection.getConnection((getErr, conn) => {
        if (getErr) {
          console.error('Could not get DB connection from pool:', getErr);
          return res.status(500).json({ error: 'Database error' });
        }

        conn.beginTransaction((txErr) => {
          if (txErr) {
            console.error('Could not start transaction:', txErr);
            conn.release();
            return res.status(500).json({ error: 'Transaction error' });
          }

          // Process items sequentially
          let idx = 0;
          const failures = [];

          function processNext() {
            if (idx >= cart.length) {
              // All updates attempted
              if (failures.length > 0) {
                // rollback
                return conn.rollback(() => {
                  conn.release();
                  return res.status(400).json({ error: failures.join('; ') });
                });
              }

              // commit
              return conn.commit((commitErr) => {
                if (commitErr) {
                  console.error('Commit error:', commitErr);
                  return conn.rollback(() => {
                    conn.release();
                    return res.status(500).json({ error: 'Server error during order processing' });
                  });
                }

                // Store order details and clear cart
                const orderId = 'ORD-' + Date.now();
                req.session.lastOrder = {
                  items: cart,
                  subtotal: taxableAmount,
                  discount: discountAmount,
                  discountCode: appliedDiscount ? appliedDiscount.code : null,
                  tax: tax,
                  total: total,
                  orderDate: new Date(),
                  orderId: orderId,
                  paymentMethod: 'Stripe',
                  txnRef: paymentIntent.id
                };
                
                // Increment discount usage if applicable
                if (appliedDiscount && appliedDiscount.id) {
                  DiscountCode.incrementUsage(appliedDiscount.id, (discErr) => {
                    if (discErr) console.error('Error incrementing discount usage:', discErr);
                  });
                }
                
                // Calculate 90/10 split: 90% to seller, 10% to admin
                const sellerEarnings = Math.round(total * 0.90 * 100) / 100;
                const adminCommission = Math.round(total * 0.10 * 100) / 100;
                
                // Save order to database
                const orderSql = 'INSERT INTO orders (orderId, userId, subtotal, tax, total, orderDate, paymentProvider, paymentReference, seller_earnings, admin_commission) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                conn.query(orderSql, [orderId, req.session.user.userId, taxableAmount, tax, total, new Date(), 'Stripe', paymentIntentId, sellerEarnings, adminCommission], (orderErr) => {
                  if (orderErr) {
                    console.error('Error saving order:', orderErr);
                  } else {
                    // Save order items
                    const itemsSql = 'INSERT INTO order_items (orderId, productId, productName, quantity, price) VALUES ?';
                    const itemsValues = cart.map(item => [orderId, item.id, item.productName, item.quantity, item.price]);
                    conn.query(itemsSql, [itemsValues], (itemsErr) => {
                      if (itemsErr) {
                        console.error('Error saving order items:', itemsErr);
                      }
                    });
                  }
                });
                
                // keep a per-session history of orders
                if (!req.session.orders) req.session.orders = [];
                req.session.orders.push(req.session.lastOrder);
                req.session.cart = [];
                delete req.session.appliedDiscount; // Clear discount
                conn.release();
                
                // Send email receipt
                const userEmail = req.session.user.email;
                emailService.sendEReceipt(userEmail, orderId, cart, taxableAmount, tax, total)
                  .then(result => {
                    if (result.success) {
                      console.log('Receipt sent successfully to:', userEmail);
                    } else {
                      console.error('Failed to send receipt:', result.message);
                    }
                  })
                  .catch(error => {
                    console.error('Error sending receipt:', error);
                  });
                
                res.json({ 
                  success: true,
                  status: 'succeeded',
                  orderId: orderId,
                  redirectUrl: '/payment/success?orderId=' + orderId + '&method=Stripe',
                  message: 'Payment successful! Your order has been placed.'
                });
              });
            }

            const item = cart[idx];
            // For car dealership: Vehicles are deleted after purchase, no stock check needed
            // Just verify the vehicle still exists
            const sql = 'SELECT id FROM products WHERE id = ?';
            conn.query(sql, [item.id], (err, result) => {
              if (err) {
                console.error('Error checking vehicle availability:', err);
                failures.push('Server error checking availability');
                idx++;
                return processNext();
              }

              if (result.length === 0) {
                // Vehicle no longer exists
                failures.push('A vehicle in your cart has been sold');
                idx++;
                processNext();
              } else {
                idx++;
                processNext();
              }
            });
          }

          processNext();
        });
      });
    } else {
      res.status(400).json({ 
        success: false,
        error: 'Payment not completed', 
        redirectUrl: '/payment/fail?method=Stripe',
        status: paymentIntent.status 
      });
    }
  } catch (err) {
    console.error('Stripe confirm payment error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to confirm payment', 
      redirectUrl: '/payment/fail?method=Stripe',
      message: err.message 
    });
  }
});

// Stripe Checkout Page
app.get('/stripe/checkout', checkAuthenticated, (req, res) => {
  const clientSecret = req.query.clientSecret;
  const amount = req.query.amount;
  
  if (!clientSecret || !amount) {
    req.flash('error', 'Missing payment information');
    return res.redirect('/cart');
  }
  
  res.render('stripeCheckout', {
    clientSecret,
    amount,
    user: req.session.user
  });
});

// Unified Payment Success Page (for all payment methods)
app.get('/payment/success', checkAuthenticated, (req, res) => {
  const orderId = req.query.orderId || 'N/A';
  const paymentMethod = req.query.method || 'Payment';
  res.render('netsTxnSuccessStatus', {
    message: 'Payment Successful! Your order has been placed.',
    orderId: orderId,
    paymentMethod: paymentMethod,
    user: req.session.user
  });
});

// Unified Payment Failure Page (for all payment methods)
app.get('/payment/fail', checkAuthenticated, (req, res) => {
  const error = req.query.error || '';
  const paymentMethod = req.query.method || 'Payment';
  res.render('netsTxnFailStatus', {
    message: 'Unfortunately, your payment could not be processed.',
    error: error,
    paymentMethod: paymentMethod,
    user: req.session.user
  });
});

// PayPal Success Page (redirect to unified)
app.get('/paypal/success', checkAuthenticated, (req, res) => {
  const orderId = req.query.orderId || 'N/A';
  res.redirect('/payment/success?orderId=' + orderId + '&method=PayPal');
});

// PayPal Failure Page (redirect to unified)
app.get('/paypal/fail', checkAuthenticated, (req, res) => {
  const error = req.query.error || '';
  res.redirect('/payment/fail?error=' + encodeURIComponent(error) + '&method=PayPal');
});

// NETS Payment Success
app.get("/nets-qr/success", checkAuthenticated, (req, res) => {
    const txnRetrievalRef = req.query.txn_retrieval_ref;
    
    // Check if this is a gift card purchase
    if (req.session.giftCardPurchase && req.session.giftCardNetsRef === txnRetrievalRef) {
        GiftCardController.finalizeGiftCardPurchase(req, res, 'nets', txnRetrievalRef);
        return;
    }
    
    // Check if this is a wallet topup
    if (req.session.walletTopup && req.session.walletTopup.txnRef === txnRetrievalRef) {
        const amount = req.session.walletTopup.amount;
        
        Wallet.deposit(
            req.session.user.userId,
            amount,
            'Wallet top-up via NETS',
            txnRetrievalRef,
            (err, newBalance) => {
                if (err) {
                    console.error('Error adding wallet funds:', err);
                    req.flash('error', 'Failed to add funds');
                    return res.redirect('/wallet/topup');
                }
                
                delete req.session.walletTopup;
                return res.redirect(`/wallet/topup/success?amount=${amount.toFixed(2)}`);
            }
        );
        return;
    }
    
    // Process regular order after successful payment
    const cart = req.session.cart || [];
    if (cart.length === 0) {
        req.flash('error', 'Your cart is empty');
        return res.redirect('/cart');
    }

    // Calculate totals with discount
    let subtotal = 0;
    for (let item of cart) {
        subtotal += item.price * item.quantity;
    }
    
    const appliedDiscount = req.session.appliedDiscount || null;
    let discountAmount = 0;
    if (appliedDiscount) {
        discountAmount = appliedDiscount.amount;
    }
    
    const discountedSubtotal = subtotal - discountAmount;
    const tax = discountedSubtotal * 0.1;
    const total = discountedSubtotal + tax;

    // Use a pooled connection and run a transaction
    connection.getConnection((getErr, conn) => {
        if (getErr) {
            console.error('Could not get DB connection from pool:', getErr);
            req.flash('error', 'Server error');
            return res.redirect('/cart');
        }

        conn.beginTransaction((txErr) => {
            if (txErr) {
                console.error('Could not start transaction:', txErr);
                conn.release();
                req.flash('error', 'Server error');
                return res.redirect('/cart');
            }

            // Process items sequentially
            let idx = 0;
            const failures = [];

            function processNext() {
                if (idx >= cart.length) {
                    // All updates attempted
                    if (failures.length > 0) {
                        // rollback
                        return conn.rollback(() => {
                            conn.release();
                            req.flash('error', failures.join('; '));
                            return res.redirect('/cart');
                        });
                    }

                    // commit
                    return conn.commit((commitErr) => {
                        if (commitErr) {
                            console.error('Commit error:', commitErr);
                            return conn.rollback(() => {
                                conn.release();
                                req.flash('error', 'Server error during order processing');
                                return res.redirect('/cart');
                            });
                        }

                        // Store order details and clear cart
                        const orderId = 'ORD-' + Date.now();
                        req.session.lastOrder = {
                            items: cart,
                            subtotal: discountedSubtotal,
                            tax: tax,
                            total: total,
                            orderDate: new Date(),
                            orderId: orderId,
                            paymentMethod: 'NETS',
                            txnRef: txnRetrievalRef
                        };
                        
                        // Increment discount usage if applicable
                        if (appliedDiscount && appliedDiscount.id) {
                            const DiscountCode = require('./models/DiscountCode');
                            DiscountCode.incrementUsage(appliedDiscount.id, (discErr) => {
                                if (discErr) console.error('Error incrementing discount usage:', discErr);
                            });
                        }
                        
                        // Calculate 90/10 split: 90% to seller, 10% to admin
                        const sellerEarnings = Math.round(total * 0.90 * 100) / 100;
                        const adminCommission = Math.round(total * 0.10 * 100) / 100;
                        
                        // Save order to database
                        const orderSql = 'INSERT INTO orders (orderId, userId, subtotal, tax, total, orderDate, paymentProvider, paymentReference, seller_earnings, admin_commission) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                        conn.query(orderSql, [orderId, req.session.user.userId, discountedSubtotal, tax, total, new Date(), 'NETS', txnRetrievalRef, sellerEarnings, adminCommission], (orderErr) => {
                            if (orderErr) {
                                console.error('Error saving order:', orderErr);
                            } else {
                                // Save order items
                                const itemsSql = 'INSERT INTO order_items (orderId, productId, productName, quantity, price) VALUES ?';
                                const itemsValues = cart.map(item => [orderId, item.id, item.productName, item.quantity, item.price]);
                                conn.query(itemsSql, [itemsValues], (itemsErr) => {
                                    if (itemsErr) {
                                        console.error('Error saving order items:', itemsErr);
                                    }
                                });
                            }
                        });
                        
                        // keep a per-session history of orders
                        if (!req.session.orders) req.session.orders = [];
                        req.session.orders.push(req.session.lastOrder);
                        req.session.cart = [];
                        req.session.appliedDiscount = null;
                        conn.release();
                        
                        // Send email receipt
                        const userEmail = req.session.user.email;
                        emailService.sendEReceipt(userEmail, orderId, cart, discountedSubtotal, tax, total)
                            .then(result => {
                                if (result.success) {
                                    console.log('Receipt sent successfully to:', userEmail);
                                } else {
                                    console.error('Failed to send receipt:', result.message);
                                }
                            })
                            .catch(error => {
                                console.error('Error sending receipt:', error);
                            });
                        
                        res.redirect('/payment/success?orderId=' + orderId + '&method=NETS');
                    });
                }

                const item = cart[idx];
                // safe update: only decrement if enough stock remains
                const sql = 'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?';
                conn.query(sql, [item.quantity, item.id, item.quantity], (err, result) => {
                    if (err) {
                        console.error('Error updating product stock:', err);
                        failures.push('Server error updating stock');
                        idx++;
                        return processNext();
                    }

                    if (result.affectedRows === 0) {
                        // fetch current quantity and product name to provide helpful message
                        conn.query('SELECT productName, quantity FROM products WHERE id = ?', [item.id], (qErr, rows) => {
                            if (qErr) {
                                console.error('Error fetching product info:', qErr);
                                failures.push(`Insufficient stock for an item (could not read availability)`);
                            } else if (rows.length > 0) {
                                const row = rows[0];
                                failures.push(`${row.productName} has only ${row.quantity} available`);
                            } else {
                                failures.push('An item in your cart is no longer available');
                            }
                            idx++;
                            processNext();
                        });
                    } else {
                        idx++;
                        processNext();
                    }
                });
            }

            processNext();
        });
    });
});

// NETS Payment Failure
app.get("/nets-qr/fail", checkAuthenticated, (req, res) => {
    const error = req.query.error || '';
    
    // Check if this is a gift card purchase
    if (req.session.giftCardPurchase) {
        delete req.session.giftCardPurchase;
        delete req.session.giftCardNetsRef;
        req.flash('error', 'Payment failed. Please try again.');
        return res.redirect('/giftcards/payment');
    }
    
    res.redirect('/payment/fail?error=' + encodeURIComponent(error) + '&method=NETS');
});

// SSE endpoint for payment status polling
app.get('/sse/payment-status/:txnRetrievalRef', checkAuthenticated, async (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const txnRetrievalRef = req.params.txnRetrievalRef;
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes if polling every 5s
    let frontendTimeoutStatus = 0;

    const interval = setInterval(async () => {
        pollCount++;

        try {
            // Call the NETS query API
            const response = await axios.post(
                'https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/query',
                { txn_retrieval_ref: txnRetrievalRef, frontend_timeout_status: frontendTimeoutStatus },
                {
                    headers: {
                        'api-key': process.env.NETS_API_KEY,
                        'project-id': process.env.NETS_PROJECT_ID,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log("Polling response:", response.data);
            // Send the full response to the frontend
            res.write(`data: ${JSON.stringify(response.data)}\n\n`);
        
            const resData = response.data.result.data;

            // Decide when to end polling and close the connection
            //Check if payment is successful
            if (resData.response_code == "00" && resData.txn_status === 1) {
                // Payment success: send a success message
                res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
                clearInterval(interval);
                res.end();
            } else if (frontendTimeoutStatus == 1 && resData && (resData.response_code !== "00" || resData.txn_status === 2)) {
                // Payment failure: send a fail message
                res.write(`data: ${JSON.stringify({ fail: true, ...resData })}\n\n`);
                clearInterval(interval);
                res.end();
            }

        } catch (err) {
            clearInterval(interval);
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }

        // Timeout
        if (pollCount >= maxPolls) {
            clearInterval(interval);
            frontendTimeoutStatus = 1;
            res.write(`data: ${JSON.stringify({ fail: true, error: "Timeout" })}\n\n`);
            res.end();
        }
    }, 5000);

    req.on('close', () => {
        clearInterval(interval);
    });
});

// ======= Checkout route =======
// Test email route - sends a test e-receipt to provided 'to' query or to logged-in user's email
app.get('/test-email', checkAuthenticated, async (req, res) => {
    const to = req.query.to || (req.session.user && req.session.user.email);
    if (!to) return res.status(400).json({ success: false, message: 'No recipient specified' });

    // Use lastOrder if available, otherwise construct a sample order
    const order = req.session.lastOrder || {
        orderId: 'TEST-' + Date.now(),
        items: [{ productName: 'Sample Product', quantity: 1, price: 9.99 }],
        subtotal: 9.99,
        tax: 0.999,
        total: 10.989
    };

    try {
        const result = await emailService.sendEReceipt(to, order.orderId, order.items, order.subtotal, order.tax, order.total);
        return res.json(result);
    } catch (err) {
        console.error('Test email error:', err);
        return res.status(500).json({ success: false, message: 'Failed to send test email' });
    }
});

// Resend receipt for the last order (used by order confirmation page)
app.post('/resend-receipt', checkAuthenticated, async (req, res) => {
    // Support resending by orderId (from session orders) or fallback to lastOrder
    const orderId = req.body && req.body.orderId;
    let order = null;
    if (orderId && req.session.orders) {
        order = req.session.orders.find(o => String(o.orderId) === String(orderId));
    }
    if (!order) order = req.session.lastOrder;
    const to = (req.session.user && req.session.user.email) || req.body.to;

    if (!order) return res.status(400).json({ success: false, message: 'No order to resend' });
    if (!to) return res.status(400).json({ success: false, message: 'No recipient email' });

    try {
        const result = await emailService.sendEReceipt(to, order.orderId, order.items, order.subtotal, order.tax, order.total);
        return res.json(result);
    } catch (err) {
        console.error('Resend receipt error:', err);
        return res.status(500).json({ success: false, message: 'Failed to resend receipt' });
    }
});

// View user's orders stored in database
app.get('/orders', checkAuthenticated, (req, res) => {
    const sql = `
        SELECT o.orderId, o.subtotal, o.tax, o.total, o.orderDate, o.refundedAmount, o.refundStatus,
               o.paymentProvider,
               oi.productId, oi.productName, oi.quantity, oi.price,
               (SELECT COUNT(*) FROM refund_requests WHERE order_id = o.orderId) as refund_request_count,
               (SELECT MAX(status) FROM refund_requests WHERE order_id = o.orderId LIMIT 1) as latest_refund_status
        FROM orders o
        LEFT JOIN order_items oi ON o.orderId = oi.orderId
        WHERE o.userId = ?
        ORDER BY o.orderDate DESC
    `;
    
    db.query(sql, [req.session.user.userId], (err, results) => {
        if (err) {
            console.error('Error fetching orders:', err);
            req.flash('error', 'Error loading orders');
            return res.redirect('/');
        }
        
        // Group items by orderId
        const ordersMap = {};
        results.forEach(row => {
            if (!ordersMap[row.orderId]) {
                ordersMap[row.orderId] = {
                    orderId: row.orderId,
                    subtotal: row.subtotal,
                    tax: row.tax,
                    total: row.total,
                    orderDate: row.orderDate,
                    refundedAmount: row.refundedAmount || 0,
                    refundStatus: row.refundStatus || 'none',
                    paymentProvider: row.paymentProvider,
                    refund_request_count: row.refund_request_count || 0,
                    latest_refund_status: row.latest_refund_status,
                    items: []
                };
            }
            if (row.productId) {
                ordersMap[row.orderId].items.push({
                    id: row.productId,
                    productName: row.productName,
                    quantity: row.quantity,
                    price: row.price
                });
            }
        });
        
        // Convert to array and sort by date (most recent first)
        const orders = Object.values(ordersMap).sort((a, b) => 
            new Date(b.orderDate) - new Date(a.orderDate)
        );
        res.render('orders/history', { 
            orders, 
            user: req.session.user,
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            }
        });
    });
});

// Refund routes
const RefundController = require('./controllers/RefundController');

// Customer refund request routes
app.get('/orders/:orderId/refund', checkAuthenticated, RefundController.showRefundForm);
app.post('/orders/:orderId/refund', checkAuthenticated, RefundController.requestRefund);

// Seller refund management routes
app.get('/seller/refund-requests', checkAuthenticated, checkSeller, RefundController.getSellerRefundRequests);
app.post('/seller/refund/:id/approve', checkAuthenticated, checkSeller, RefundController.approveRefund);
app.post('/seller/refund/:id/reject', checkAuthenticated, checkSeller, RefundController.rejectRefund);

// Analytics routes
const AnalyticsController = require('./controllers/AnalyticsController');

app.get('/api/seller/analytics', checkAuthenticated, checkSeller, AnalyticsController.getVehicleAnalytics);
app.get('/api/seller/analytics/summary', checkAuthenticated, checkSeller, AnalyticsController.getAnalyticsSummary);
app.get('/api/seller/analytics/viewers/:vehicleId', checkAuthenticated, checkSeller, AnalyticsController.getVehicleViewers);

// Verify SMTP connection (dev endpoint)
app.get('/verify-email', async (req, res) => {
    try {
        await emailService.verifyTransporter();
        return res.json({ success: true, message: 'SMTP connection OK' });
    } catch (err) {
        console.error('SMTP verify error:', err);
        return res.status(500).json({ success: false, message: err.message || 'SMTP verify failed' });
    }
});

// 404 Error Handler - must be after all other routes
app.use((req, res, next) => {
    res.status(404).render('error', { 
        statusCode: 404, 
        message: 'Page Not Found',
        description: 'The page you are looking for does not exist.',
        user: req.session.user 
    });
});

// ======= Currency Exchange Endpoints =======
const currencyService = require('./utils/currencyService');

// Get supported currencies for a payment provider
app.get('/api/currencies/supported/:provider', (req, res) => {
  try {
    const provider = req.params.provider.toLowerCase();
    const supportedCurrencies = currencyService.getSupportedCurrencies(provider);
    
    if (!supportedCurrencies || supportedCurrencies.length === 0) {
      return res.status(400).json({ error: 'Invalid payment provider' });
    }
    
    res.json({
      provider: provider,
      currencies: supportedCurrencies,
      count: supportedCurrencies.length
    });
  } catch (error) {
    console.error('Error getting supported currencies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert currency
app.post('/api/currencies/convert', async (req, res) => {
  try {
    const { amount, fromCurrency = 'SGD', toCurrency = 'SGD' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const convertedAmount = await currencyService.convertCurrency(amount, fromCurrency, toCurrency);
    
    res.json({
      original: {
        amount: parseFloat(amount),
        currency: fromCurrency.toUpperCase()
      },
      converted: {
        amount: parseFloat(convertedAmount),
        currency: toCurrency.toUpperCase()
      },
      rate: (parseFloat(convertedAmount) / parseFloat(amount)).toFixed(6)
    });
  } catch (error) {
    console.error('Currency conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get exchange rates
app.get('/api/currencies/rates/:baseCurrency', async (req, res) => {
  try {
    const baseCurrency = req.params.baseCurrency || 'SGD';
    const rates = await currencyService.getExchangeRates(baseCurrency.toUpperCase());
    
    res.json({
      baseCurrency: baseCurrency.toUpperCase(),
      rates: rates
    });
  } catch (error) {
    console.error('Error getting exchange rates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get exchange rates (default to SGD)
app.get('/api/currencies/rates', async (req, res) => {
  try {
    const rates = await currencyService.getExchangeRates('SGD');
    
    res.json({
      baseCurrency: 'SGD',
      rates: rates
    });
  } catch (error) {
    console.error('Error getting exchange rates:', error);
    res.status(500).json({ error: error.message });
  }
});

// 500 Error Handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).render('error', { 
        statusCode: 500, 
        message: 'Internal Server Error',
        description: 'Something went wrong on our end. Please try again later.',
        user: req.session.user 
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));
