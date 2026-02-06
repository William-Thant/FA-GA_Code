const db = require('../db');

const DiscountCode = {
  /**
   * Validate a discount code
   * @param {string} code - The discount code
   * @param {number} subtotal - The cart subtotal
   * @returns {Promise} - Resolves with discount info or error
   */
  validate(code, subtotal, callback) {
    const sql = `
      SELECT * FROM discount_codes 
      WHERE code = ? 
      AND active = 1 
      AND (expiryDate IS NULL OR expiryDate > NOW())
      AND (maxUses IS NULL OR usedCount < maxUses)
    `;
    
    db.query(sql, [code.toUpperCase()], (err, results) => {
      if (err) {
        return callback(err);
      }
      
      if (results.length === 0) {
        return callback(new Error('Invalid or expired discount code'));
      }
      
      const discount = results[0];
      
      // Convert numeric fields to proper types
      discount.minPurchase = parseFloat(discount.minPurchase) || 0;
      discount.value = parseFloat(discount.value) || 0;
      discount.maxUses = parseInt(discount.maxUses) || null;
      discount.usedCount = parseInt(discount.usedCount) || 0;
      
      // Check minimum purchase requirement
      if (discount.minPurchase > 0 && subtotal < discount.minPurchase) {
        return callback(new Error(`Minimum purchase of $${discount.minPurchase.toFixed(2)} required`));
      }
      
      callback(null, discount);
    });
  },

  /**
   * Calculate discount amount
   * @param {object} discount - Discount object from database
   * @param {number} subtotal - The cart subtotal
   * @returns {number} - Discount amount
   */
  calculateDiscount(discount, subtotal) {
    if (discount.type === 'percentage') {
      return (subtotal * discount.value) / 100;
    } else {
      return discount.value;
    }
  },

  /**
   * Increment usage count for a discount code
   * @param {number} discountId - The discount code ID
   * @returns {Promise}
   */
  incrementUsage(discountId, callback) {
    const sql = 'UPDATE discount_codes SET usedCount = usedCount + 1 WHERE id = ?';
    db.query(sql, [discountId], callback);
  },

  /**
   * Get all active discount codes (for admin)
   * @returns {Promise}
   */
  getAll(callback) {
    const sql = 'SELECT * FROM discount_codes ORDER BY createdAt DESC';
    db.query(sql, callback);
  },

  /**
   * Get active public discount codes
   * @returns {Promise}
   */
  getActive(callback) {
    const sql = `
      SELECT code, type, value, minPurchase, expiryDate 
      FROM discount_codes 
      WHERE active = 1 
      AND (expiryDate IS NULL OR expiryDate > NOW())
      AND (maxUses IS NULL OR usedCount < maxUses)
      ORDER BY value DESC
    `;
    db.query(sql, callback);
  },

  /**
   * Create a new discount code
   * @param {object} discountData - Discount code data
   * @returns {Promise}
   */
  create(discountData, callback) {
    const sql = `
      INSERT INTO discount_codes 
      (code, type, value, minPurchase, maxUses, expiryDate, active) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      discountData.code.toUpperCase(),
      discountData.type,
      discountData.value,
      discountData.minPurchase || 0,
      discountData.maxUses || null,
      discountData.expiryDate || null,
      discountData.active !== undefined ? discountData.active : 1
    ];
    db.query(sql, values, callback);
  },

  /**
   * Update a discount code
   * @param {number} id - Discount code ID
   * @param {object} discountData - Updated discount code data
   * @returns {Promise}
   */
  update(id, discountData, callback) {
    const sql = `
      UPDATE discount_codes 
      SET code = ?, type = ?, value = ?, minPurchase = ?, 
          maxUses = ?, expiryDate = ?, active = ?
      WHERE id = ?
    `;
    const values = [
      discountData.code.toUpperCase(),
      discountData.type,
      discountData.value,
      discountData.minPurchase || 0,
      discountData.maxUses || null,
      discountData.expiryDate || null,
      discountData.active !== undefined ? discountData.active : 1,
      id
    ];
    db.query(sql, values, callback);
  },

  /**
   * Delete a discount code
   * @param {number} id - Discount code ID
   * @returns {Promise}
   */
  delete(id, callback) {
    const sql = 'DELETE FROM discount_codes WHERE id = ?';
    db.query(sql, [id], callback);
  },

  /**
   * Get discount code by ID
   * @param {number} id - Discount code ID
   * @returns {Promise}
   */
  getById(id, callback) {
    const sql = 'SELECT * FROM discount_codes WHERE id = ?';
    db.query(sql, [id], callback);
  }
};

module.exports = DiscountCode;
