const User = require("../models/User");

const UserController = {
  // Render login form
  loginForm(req, res) {
    const formData = req.flash("formData")[0] || {};
    const errors = req.flash("error") || [];
    res.render("auth/login", { formData, errors, user: req.session.user });
  },

  // Handle login
  login(req, res) {
    const { email, password } = req.body;
    User.getByCredentials(email, password, (err, userData) => {
      if (err) return res.status(500).send("Server error");
      if (!userData) {
        req.flash("error", "Invalid email or password");
        req.flash("formData", req.body);
        return res.redirect("/login");
      }
      // Normalize id/name fields from different schemas (userId vs id vs user_id, name vs username)
      const id = userData.userId || userData.id || userData.user_id || userData.uid;
      const name = userData.name || userData.username || userData.fullname || userData.email || '';
      const role = userData.role || userData.user_role || 'user';

      req.session.user = {
        userId: id,
        name: name,
        email: userData.email,
        role: role,
        is_seller: userData.is_seller || false,
        seller_status: userData.seller_status || null
      };
      console.log('User logged in, session.user =', req.session.user);
      req.flash("success", "Logged in");
      if (userData.role === "admin") {
        return res.redirect("/admin/dashboard");
      } else {
        return res.redirect("/shop");
      }
    });
  },

  // Logout
  logout(req, res) {
    req.session.destroy((err) => {
      res.redirect("/");
    });
  },
};

module.exports = UserController;
