const db = require('../db');
const crypto = require('crypto');

class GiftCard {
  /**
   * Generate unique gift card code
   */
  static generateCode() {
    const prefix = 'GC';
    const randomPart = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${prefix}${randomPart}`;
  }

  /**
   * Create a new gift card
   */
  static create(data, callback) {
    const code = this.generateCode();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year validity
    
    const sql = `
      INSERT INTO gift_cards 
      (code, initialAmount, currentBalance, purchasedBy, recipientEmail, recipientName, message, expiryDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      code,
      data.amount,
      data.amount,
      data.purchasedBy,
      data.recipientEmail || null,
      data.recipientName || null,
      data.message || null,
      expiryDate
    ];
    
    db.query(sql, values, (err, result) => {
      if (err) return callback(err);
      
      // Record purchase transaction
      const transSql = `
        INSERT INTO gift_card_transactions 
        (giftCardId, transactionType, amount, balanceBefore, balanceAfter, userId)
        VALUES (?, 'purchase', ?, 0, ?, ?)
      `;
      
      db.query(transSql, [result.insertId, data.amount, data.amount, data.purchasedBy], (transErr) => {
        if (transErr) console.error('Transaction log error:', transErr);
        callback(null, { id: result.insertId, code, amount: data.amount, expiryDate });
      });
    });
  }

  /**
   * Validate and get gift card info
   */
  static validate(code, callback) {
    const sql = `
      SELECT * FROM gift_cards 
      WHERE code = ? 
      AND status = 'active' 
      AND currentBalance > 0
      AND (expiryDate IS NULL OR expiryDate > NOW())
    `;
    
    db.query(sql, [code.toUpperCase()], (err, results) => {
      if (err) return callback(err);
      if (results.length === 0) {
        return callback(new Error('Invalid, expired, or depleted gift card'));
      }
      callback(null, results[0]);
    });
  }

  /**
   * Get gift card balance
   */
  static getBalance(code, callback) {
    this.validate(code, (err, giftCard) => {
      if (err) return callback(err);
      callback(null, {
        balance: parseFloat(giftCard.currentBalance),
        expiryDate: giftCard.expiryDate
      });
    });
  }

  /**
   * Redeem/use gift card (full or partial)
   */
  static redeem(code, amount, userId, orderId, callback) {
    this.validate(code, (err, giftCard) => {
      if (err) return callback(err);
      
      const currentBalance = parseFloat(giftCard.currentBalance);
      if (currentBalance < amount) {
        return callback(new Error('Insufficient gift card balance'));
      }
      
      const newBalance = currentBalance - amount;
      const newStatus = newBalance === 0 ? 'redeemed' : 'active';
      
      db.getConnection((connErr, conn) => {
        if (connErr) return callback(connErr);
        
        conn.beginTransaction((transErr) => {
          if (transErr) {
            conn.release();
            return callback(transErr);
          }
          
          // Update gift card balance
          let updateSql, updateValues;
          if (newStatus === 'redeemed') {
            updateSql = `
              UPDATE gift_cards 
              SET currentBalance = ?, 
                  status = ?,
                  redeemedAt = NOW(),
                  redeemedBy = ?
              WHERE id = ?
            `;
            updateValues = [newBalance, newStatus, userId, giftCard.id];
          } else {
            updateSql = `
              UPDATE gift_cards 
              SET currentBalance = ?, 
                  status = ?
              WHERE id = ?
            `;
            updateValues = [newBalance, newStatus, giftCard.id];
          }
          
          conn.query(updateSql, updateValues, (updateErr) => {
            if (updateErr) {
              return conn.rollback(() => {
                conn.release();
                callback(updateErr);
              });
            }
            
            // Log transaction
            const transSql = `
              INSERT INTO gift_card_transactions 
              (giftCardId, transactionType, amount, balanceBefore, balanceAfter, orderId, userId)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            conn.query(transSql, 
              [giftCard.id, newBalance === 0 ? 'redemption' : 'partial_use', amount, currentBalance, newBalance, orderId, userId],
              (transErr) => {
                if (transErr) {
                  return conn.rollback(() => {
                    conn.release();
                    callback(transErr);
                  });
                }
                
                conn.commit((commitErr) => {
                  if (commitErr) {
                    return conn.rollback(() => {
                      conn.release();
                      callback(commitErr);
                    });
                  }
                  conn.release();
                  callback(null, {
                    amountUsed: amount,
                    remainingBalance: newBalance,
                    fullyRedeemed: newBalance === 0
                  });
                });
              }
            );
          });
        });
      });
    });
  }

  /**
   * Get user's purchased gift cards
   */
  static getUserPurchased(userId, callback) {
    const sql = `
      SELECT * FROM gift_cards 
      WHERE purchasedBy = ? 
      ORDER BY createdAt DESC
    `;
    db.query(sql, [userId], callback);
  }

  /**
   * Get gift card transaction history
   */
  static getTransactions(giftCardId, callback) {
    const sql = `
      SELECT t.*, u.username 
      FROM gift_card_transactions t
      LEFT JOIN users u ON t.userId = u.id
      WHERE t.giftCardId = ?
      ORDER BY t.createdAt DESC
    `;
    db.query(sql, [giftCardId], callback);
  }

  /**
   * Get gift card by code (for displaying details)
   */
  static getByCode(code, callback) {
    const sql = 'SELECT * FROM gift_cards WHERE code = ?';
    db.query(sql, [code.toUpperCase()], (err, results) => {
      if (err) return callback(err);
      if (results.length === 0) return callback(new Error('Gift card not found'));
      callback(null, results[0]);
    });
  }
}

module.exports = GiftCard;
