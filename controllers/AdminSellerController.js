const db = require('../db');

const AdminSellerController = {
    // View all seller applications
    index(req, res) {
        const sql = `
            SELECT u.id, u.username, u.email, u.seller_status, u.created_at, u.seller_approved_at,
                   sp.business_name, sp.business_phone, sp.business_address, sp.business_description
            FROM users u
            LEFT JOIN seller_profile sp ON u.id = sp.user_id
            WHERE u.is_seller = true
            ORDER BY 
                CASE u.seller_status
                    WHEN 'pending' THEN 1
                    WHEN 'approved' THEN 2
                    WHEN 'rejected' THEN 3
                    WHEN 'suspended' THEN 4
                END,
                u.created_at DESC
        `;

        db.query(sql, (err, sellers) => {
            if (err) {
                console.error('Error fetching sellers:', err);
                req.flash('error', 'Failed to load seller applications');
                return res.redirect('/admin/dashboard');
            }

            res.render('admin/sellers', {
                user: req.session.user,
                sellers: sellers || [],
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        });
    },

    // Approve a seller application
    approve(req, res) {
        const sellerId = req.params.id;

        db.query('SELECT seller_status FROM users WHERE id = ?', [sellerId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching seller:', err);
                req.flash('error', 'Seller not found');
                return res.redirect('/admin/sellers');
            }

            if (results[0].seller_status !== 'pending') {
                req.flash('error', 'This application is not pending');
                return res.redirect('/admin/sellers');
            }

            const sql = 'UPDATE users SET seller_status = ?, seller_approved_at = NOW() WHERE id = ?';
            db.query(sql, ['approved', sellerId], (updateErr) => {
                if (updateErr) {
                    console.error('Error approving seller:', updateErr);
                    req.flash('error', 'Failed to approve seller');
                    return res.redirect('/admin/sellers');
                }

                req.flash('success', 'Seller application approved successfully');
                res.redirect('/admin/sellers');
            });
        });
    },

    // Reject a seller application
    reject(req, res) {
        const sellerId = req.params.id;

        db.query('SELECT seller_status FROM users WHERE id = ?', [sellerId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching seller:', err);
                req.flash('error', 'Seller not found');
                return res.redirect('/admin/sellers');
            }

            if (results[0].seller_status !== 'pending') {
                req.flash('error', 'This application is not pending');
                return res.redirect('/admin/sellers');
            }

            const sql = 'UPDATE users SET seller_status = ?, is_seller = false WHERE id = ?';
            db.query(sql, ['rejected', sellerId], (updateErr) => {
                if (updateErr) {
                    console.error('Error rejecting seller:', updateErr);
                    req.flash('error', 'Failed to reject seller');
                    return res.redirect('/admin/sellers');
                }

                req.flash('success', 'Seller application rejected');
                res.redirect('/admin/sellers');
            });
        });
    },

    // Suspend a seller
    suspend(req, res) {
        const sellerId = req.params.id;

        db.query('SELECT seller_status FROM users WHERE id = ?', [sellerId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching seller:', err);
                req.flash('error', 'Seller not found');
                return res.redirect('/admin/sellers');
            }

            if (results[0].seller_status !== 'approved') {
                req.flash('error', 'Can only suspend approved sellers');
                return res.redirect('/admin/sellers');
            }

            const sql = 'UPDATE users SET seller_status = ? WHERE id = ?';
            db.query(sql, ['suspended', sellerId], (updateErr) => {
                if (updateErr) {
                    console.error('Error suspending seller:', updateErr);
                    req.flash('error', 'Failed to suspend seller');
                    return res.redirect('/admin/sellers');
                }

                req.flash('success', 'Seller suspended successfully');
                res.redirect('/admin/sellers');
            });
        });
    },

    // Reactivate a suspended seller
    reactivate(req, res) {
        const sellerId = req.params.id;

        db.query('SELECT seller_status FROM users WHERE id = ?', [sellerId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching seller:', err);
                req.flash('error', 'Seller not found');
                return res.redirect('/admin/sellers');
            }

            if (results[0].seller_status !== 'suspended') {
                req.flash('error', 'Can only reactivate suspended sellers');
                return res.redirect('/admin/sellers');
            }

            const sql = 'UPDATE users SET seller_status = ? WHERE id = ?';
            db.query(sql, ['approved', sellerId], (updateErr) => {
                if (updateErr) {
                    console.error('Error reactivating seller:', updateErr);
                    req.flash('error', 'Failed to reactivate seller');
                    return res.redirect('/admin/sellers');
                }

                req.flash('success', 'Seller reactivated successfully');
                res.redirect('/admin/sellers');
            });
        });
    }
};

module.exports = AdminSellerController;
