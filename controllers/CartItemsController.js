const CartItems = require('../models/CartItem');
const Fines = require('../models/Fine');

const CartItemsController = {
    // List all cart items for the logged-in user
    list(req, res) {
        const userId = req.session.user.userId;
        CartItems.getByUserId(userId, (err, cartItems) => {
            if (err) return res.status(500).send('Error retrieving cart');
            res.render('fines/cart', { cartItems, user: req.session.user });
        });
    },

    // Add a fine to the cart
    add(req, res) {
        const userId = req.session.user.userId;
        const fineId = parseInt(req.body.fineId, 10);
        Fines.getByIds([fineId], (err, fines) => {
            if (err || !fines.length || fines[0].paid) {
                req.flash('error', 'Cannot add paid or invalid fine');
                return res.redirect('/fines');
            }
            CartItems.add(userId, fineId, (err) => {
                if (err) req.flash('error', 'Could not add to cart');
                else req.flash('success', 'Fine added to cart');
                res.redirect('/fines');
            });
        });
    },

    // Remove a fine from the cart
    remove(req, res) {
        const userId = req.session.user.userId;
        const fineId = parseInt(req.body.fineId, 10);
        CartItems.remove(userId, fineId, (err) => {
            if (req.headers['content-type'] === 'application/json') {
                // AJAX/fetch request, return JSON
                if (err) return res.status(500).json({ success: false, message: 'Could not remove from cart' });
                return res.json({ success: true, fineId });
            } else {
                // Form POST, redirect
                if (err) req.flash('error', 'Could not remove from cart');
                else req.flash('success', 'Fine removed from cart');
                res.redirect('/fines');
            }
        });
    },

    // Clear all fines from the cart
    clear(req, res) {
        const userId = req.session.user.userId;
        CartItems.clear(userId, (err) => {
            if (req.headers['content-type'] === 'application/json') {
                // AJAX/fetch request, return JSON
                if (err) return res.status(500).json({ success: false, message: 'Could not clear cart' });
                return res.json({ success: true });
            } else {
                // Form POST, redirect
                if (err) req.flash('error', 'Could not clear cart');
                else req.flash('success', 'Cart cleared');
                res.redirect('/fines');
            }
        });
    }
};

module.exports = CartItemsController;
