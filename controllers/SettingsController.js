const db = require('../db');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const SettingsController = {
    // Display settings page
    index(req, res) {
        if (!req.session.user) {
            console.log('No session user, redirecting to login');
            return res.redirect('/login');
        }
        
        console.log('Session user:', req.session.user);
        const userId = req.session.user.userId || req.session.user.id;
        
        if (!userId) {
            console.log('No userId found in session, redirecting to login');
            return res.redirect('/login');
        }
        
        console.log('Fetching user data for userId:', userId);
        
        // Get user data from database - using 'id' column
        db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                console.error('Error fetching user data:', err);
                req.flash('error', 'Error loading settings');
                return res.redirect('/');
            }
            
            if (results.length === 0) {
                console.log('User not found in database for userId:', userId);
                return res.redirect('/login');
            }
            
            const userData = results[0];
            console.log('User data fetched:', { id: userData.id, username: userData.username, email: userData.email });
            
            // Merge database data with session
            const user = {
                userId: userData.id,
                id: userData.id,
                username: userData.username || userData.name || req.session.user.name,
                name: userData.username || userData.name || req.session.user.name,
                email: userData.email,
                contact: userData.contact || '',
                address: userData.address || '',
                role: userData.role || req.session.user.role,
                emailNotifications: userData.emailNotifications || false,
                promotionalEmails: userData.promotionalEmails || false,
                newsletter: userData.newsletter || false,
                is_seller: userData.is_seller || false,
                seller_status: userData.seller_status || null
            };
            
            console.log('Rendering settings page for user:', user.username);
            
            res.render('settings', {
                user: user,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        });
    },

    // Update profile information
    updateProfile(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const { username, email, contact, address } = req.body;

        // Validate inputs
        if (!username || !email) {
            req.flash('error', 'Username and email are required');
            return res.redirect('/settings');
        }

        // Check if email is already used by another user
        db.query('SELECT id FROM users WHERE email = ? AND id != ?', 
            [email, userId], (checkErr, existingUsers) => {
            if (checkErr) {
                console.error('Error checking email:', checkErr);
                req.flash('error', 'Server error');
                return res.redirect('/settings');
            }

            if (existingUsers.length > 0) {
                req.flash('error', 'Email is already in use by another account');
                return res.redirect('/settings');
            }

            // Update user profile
            const sql = 'UPDATE users SET username = ?, email = ?, contact = ?, address = ? WHERE id = ?';
            db.query(sql, [username, email, contact, address, userId], (err, result) => {
                if (err) {
                    console.error('Error updating profile:', err);
                    req.flash('error', 'Failed to update profile');
                    return res.redirect('/settings');
                }

                // Update session
                req.session.user.name = username;
                req.session.user.email = email;

                req.flash('success', 'Profile updated successfully');
                res.redirect('/settings');
            });
        });
    },

    // Change password
    changePassword(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate inputs
        if (!currentPassword || !newPassword || !confirmPassword) {
            req.flash('error', 'All password fields are required');
            return res.redirect('/settings');
        }

        if (newPassword.length < 6) {
            req.flash('error', 'New password must be at least 6 characters long');
            return res.redirect('/settings');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'New passwords do not match');
            return res.redirect('/settings');
        }

        // Get user's current password
        db.query('SELECT password FROM users WHERE id = ?', [userId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching user:', err);
                req.flash('error', 'User not found');
                return res.redirect('/settings');
            }

            const storedPassword = results[0].password;

            // Verify current password
            bcrypt.compare(currentPassword, storedPassword, (compareErr, isMatch) => {
                if (compareErr || !isMatch) {
                    req.flash('error', 'Current password is incorrect');
                    return res.redirect('/settings');
                }

                // Hash new password
                bcrypt.hash(newPassword, 10, (hashErr, hashedPassword) => {
                    if (hashErr) {
                        console.error('Error hashing password:', hashErr);
                        req.flash('error', 'Server error');
                        return res.redirect('/settings');
                    }

                    // Update password
                    db.query('UPDATE users SET password = ? WHERE id = ?', 
                        [hashedPassword, userId], (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating password:', updateErr);
                            req.flash('error', 'Failed to update password');
                            return res.redirect('/settings');
                        }

                        req.flash('success', 'Password changed successfully');
                        res.redirect('/settings');
                    });
                });
            });
        });
    },

    // Update notification preferences
    updateNotifications(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const emailNotifications = req.body.emailNotifications === 'on';
        const promotionalEmails = req.body.promotionalEmails === 'on';
        const newsletter = req.body.newsletter === 'on';

        const sql = 'UPDATE users SET emailNotifications = ?, promotionalEmails = ?, newsletter = ? WHERE id = ?';
        db.query(sql, [emailNotifications, promotionalEmails, newsletter, userId], (err) => {
            if (err) {
                console.error('Error updating notifications:', err);
                req.flash('error', 'Failed to update notification preferences');
                return res.redirect('/settings');
            }

            req.session.user.emailNotifications = emailNotifications;
            req.session.user.promotionalEmails = promotionalEmails;
            req.session.user.newsletter = newsletter;

            req.flash('success', 'Notification preferences updated');
            res.redirect('/settings');
        });
    },

    // Delete account
    deleteAccount(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const { password } = req.body;

        if (!password) {
            req.flash('error', 'Password is required to delete account');
            return res.redirect('/settings');
        }

        // Verify password
        db.query('SELECT password FROM users WHERE id = ?', [userId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching user:', err);
                req.flash('error', 'User not found');
                return res.redirect('/settings');
            }

            const storedPassword = results[0].password;

            bcrypt.compare(password, storedPassword, (compareErr, isMatch) => {
                if (compareErr || !isMatch) {
                    req.flash('error', 'Incorrect password');
                    return res.redirect('/settings');
                }

                // Delete user account and related data
                db.query('DELETE FROM cart_items WHERE userId = ?', [userId], (cartErr) => {
                    // Continue even if cart deletion fails
                    db.query('DELETE FROM users WHERE id = ?', [userId], (deleteErr) => {
                        if (deleteErr) {
                            console.error('Error deleting account:', deleteErr);
                            req.flash('error', 'Failed to delete account');
                            return res.redirect('/settings');
                        }

                        // Destroy session and redirect
                        req.session.destroy((sessionErr) => {
                            if (sessionErr) {
                                console.error('Error destroying session:', sessionErr);
                            }
                            res.redirect('/');
                        });
                    });
                });
            });
        });
    },

    // Apply to become a seller
    applySeller(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const { businessName, businessPhone, businessAddress, businessDescription, agreeTerms } = req.body;

        // Validate inputs
        if (!businessName || !businessPhone || !businessAddress || !businessDescription) {
            req.flash('error', 'All fields are required');
            return res.redirect('/settings');
        }

        if (!agreeTerms) {
            req.flash('error', 'You must agree to the terms and conditions');
            return res.redirect('/settings');
        }

        // Check if user already has a pending or approved application
        db.query('SELECT is_seller, seller_status FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                console.error('Error checking seller status:', err);
                req.flash('error', 'Server error');
                return res.redirect('/settings');
            }

            if (results.length === 0) {
                req.flash('error', 'User not found');
                return res.redirect('/settings');
            }

            const user = results[0];
            if (user.seller_status === 'pending') {
                req.flash('error', 'You already have a pending seller application');
                return res.redirect('/settings');
            }

            if (user.is_seller && user.seller_status === 'approved') {
                req.flash('error', 'You are already an approved seller');
                return res.redirect('/settings');
            }

            // Update user to seller status pending
            const updateUserSql = 'UPDATE users SET is_seller = true, seller_status = ? WHERE id = ?';
            db.query(updateUserSql, ['pending', userId], (updateErr) => {
                if (updateErr) {
                    console.error('Error updating user seller status:', updateErr);
                    req.flash('error', 'Failed to submit application');
                    return res.redirect('/settings');
                }

                // Insert or update seller profile
                const checkProfileSql = 'SELECT profile_id FROM seller_profile WHERE user_id = ?';
                db.query(checkProfileSql, [userId], (checkErr, profileResults) => {
                    if (checkErr) {
                        console.error('Error checking seller profile:', checkErr);
                        req.flash('error', 'Failed to submit application');
                        return res.redirect('/settings');
                    }

                    if (profileResults.length > 0) {
                        // Update existing profile
                        const updateProfileSql = `UPDATE seller_profile 
                            SET business_name = ?, business_phone = ?, business_address = ?, business_description = ?
                            WHERE user_id = ?`;
                        db.query(updateProfileSql, [businessName, businessPhone, businessAddress, businessDescription, userId], (profileErr) => {
                            if (profileErr) {
                                console.error('Error updating seller profile:', profileErr);
                                req.flash('error', 'Failed to update profile');
                                return res.redirect('/settings');
                            }

                            req.session.user.seller_status = 'pending';
                            req.flash('success', 'Your seller application has been submitted and is pending approval');
                            res.redirect('/settings');
                        });
                    } else {
                        // Insert new profile
                        const insertProfileSql = `INSERT INTO seller_profile 
                            (user_id, business_name, business_phone, business_address, business_description) 
                            VALUES (?, ?, ?, ?, ?)`;
                        db.query(insertProfileSql, [userId, businessName, businessPhone, businessAddress, businessDescription], (insertErr) => {
                            if (insertErr) {
                                console.error('Error inserting seller profile:', insertErr);
                                req.flash('error', 'Failed to submit application');
                                return res.redirect('/settings');
                            }

                            req.session.user.seller_status = 'pending';
                            req.flash('success', 'Your seller application has been submitted and is pending approval');
                            res.redirect('/settings');
                        });
                    }
                });
            });
        });
    }
};

module.exports = SettingsController;
