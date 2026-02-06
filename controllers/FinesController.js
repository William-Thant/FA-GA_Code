const Fine = require("../models/Fine");
const User = require("../models/User");
const CartItems = require("../models/CartItem");

const FinesController = {
  // List all fines for the logged-in user
  list(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send("Unauthorized");
    Fine.getByUserIdWithType(userId, (err, fines) => {
      if (err) return res.status(500).send("Error retrieving fines");
      CartItems.getByUserId(userId, (cartErr, cartItems) => {
        if (cartErr) return res.status(500).send("Error retrieving cart");
        const cart = cartItems.map((item) => item.fineId);
        res.render("fines/fines", { fines, cart, user: req.session.user });
      });
    });
  },

  // Mark selected fines as paid and remove them from cart
  pay(req, res) {
    const fineIds = req.body["fineIds[]"] || req.body.fineIds || [];
    const ids = Array.isArray(fineIds) ? fineIds : [fineIds];
    if (!ids.length || !ids[0]) {
      req.flash("error", "No fines selected for payment.");
      return res.redirect("/fines");
    }
    Fine.markPaid(ids, (err) => {
      if (err) {
        req.flash("error", "Payment failed.");
        return res.redirect("/fines");
      }
      // Remove paid fines from cart
      const userId = req.session.user.userId;
      CartItems.removeBulk(userId, ids, (removeErr) => {
        if (removeErr) {
          req.flash("error", "Could not clear paid fines from cart.");
          return res.redirect("/fines");
        }
        Fine.getByIds(ids, (fetchErr, fines) => {
          if (fetchErr) {
            req.flash("error", "Could not fetch invoice details.");
            return res.redirect("/fines");
          }
          res.render("fines/invoice", { fines, user: req.session.user });
        });
      });
    });
  },

  showFineUserForm(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send("Forbidden2");
    }
    User.getAll((err, users) => {
      if (err) return res.status(500).send("Error retrieving users");
      Fine.getFineTypes((err2, fineTypes) => {
        if (err2) return res.status(500).send("Error retrieving fine types");
        res.render("fines/fineUser", { users, fineTypes, user: req.session.user });
      });
    });
  },

  fineUser(req, res) {
    console.log("Fine User Request Body:", req.body);
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send("Forbidden2");
    }
    const { userId, fineTypeId, amount, description } = req.body;
    Fine.addFine(
      {
        userId,
        fineTypeId,
        amount,
        description,
        paid: false,
      },
      (err) => {
        if (err) {
          req.flash("error", "Could not fine user");
          return res.redirect("/admin/fine-user");
        }
        req.flash("success", "Fine assigned to user");
        res.redirect("/admin/dashboard");
      }
    );
  },

  adminDashboard(req, res) {
    console.log("Admin Dashboard Accessed by:", req.session.user);
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    
    const db = require('../db');
    
    // Get all users with registration dates and seller status
    db.query('SELECT id, username, email, role, created_at, is_seller, seller_status FROM users ORDER BY created_at DESC', (err, users) => {
      if (err) {
        console.error('Error retrieving users:', err);
        return res.status(500).send("Error retrieving users");
      }
      
      // Get product statistics
      db.query('SELECT COUNT(*) as totalProducts, SUM(CASE WHEN quantity < 10 THEN 1 ELSE 0 END) as lowStock FROM products', (err2, productStats) => {
        if (err2) {
          console.error('Error retrieving product stats:', err2);
          return res.status(500).send("Error retrieving product statistics");
        }
        
        // Get low stock products
        db.query('SELECT id, productName, quantity, price, category FROM products WHERE quantity < 10 ORDER BY quantity ASC', (err3, lowStockProducts) => {
          if (err3) {
            console.error('Error retrieving low stock products:', err3);
            lowStockProducts = [];
          }
          
          res.render("admin/dashboard", { 
            users: users || [], 
            user: req.session.user,
            productStats: productStats[0] || { totalProducts: 0, lowStock: 0 },
            lowStockProducts: lowStockProducts || [],
            messages: { error: req.flash('error'), success: req.flash('success') }
          });
        });
      });
    });
  },
};

module.exports = FinesController;
