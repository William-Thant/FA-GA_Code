const connection = require('../db');

class Wallet {
  /**
   * Get user's current wallet balance
   */
  static getBalance(userId, callback) {
    const sql = 'SELECT wallet_balance FROM users WHERE id = ?';
    connection.query(sql, [userId], (err, results) => {
      if (err) return callback(err);
      if (results.length === 0) return callback(new Error('User not found'));
      callback(null, parseFloat(results[0].wallet_balance) || 0);
    });
  }

  /**
   * Add funds to wallet
   */
  static deposit(userId, amount, description, reference, callback) {
    this.getBalance(userId, (err, currentBalance) => {
      if (err) return callback(err);
      
      const newBalance = currentBalance + parseFloat(amount);
      
      connection.getConnection((connErr, conn) => {
        if (connErr) return callback(connErr);
        
        conn.beginTransaction((transErr) => {
          if (transErr) {
            conn.release();
            return callback(transErr);
          }
          
          // Update user balance
          const updateSql = 'UPDATE users SET wallet_balance = ? WHERE id = ?';
          conn.query(updateSql, [newBalance, userId], (updateErr) => {
            if (updateErr) {
              return conn.rollback(() => {
                conn.release();
                callback(updateErr);
              });
            }
            
            // Record transaction
            const recordSql = `
              INSERT INTO wallet_transactions 
              (userId, type, amount, balance_before, balance_after, description, reference)
              VALUES (?, 'deposit', ?, ?, ?, ?, ?)
            `;
            conn.query(recordSql, [userId, amount, currentBalance, newBalance, description, reference], (recordErr) => {
              if (recordErr) {
                return conn.rollback(() => {
                  conn.release();
                  callback(recordErr);
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
                callback(null, newBalance);
              });
            });
          });
        });
      });
    });
  }

  /**
   * Deduct funds from wallet (for purchases)
   */
  static deduct(userId, amount, description, reference, callback) {
    this.getBalance(userId, (err, currentBalance) => {
      if (err) return callback(err);
      
      if (currentBalance < amount) {
        return callback(new Error('Insufficient wallet balance'));
      }
      
      const newBalance = currentBalance - parseFloat(amount);
      
      connection.getConnection((connErr, conn) => {
        if (connErr) return callback(connErr);
        
        conn.beginTransaction((transErr) => {
          if (transErr) {
            conn.release();
            return callback(transErr);
          }
          
          // Update user balance
          const updateSql = 'UPDATE users SET wallet_balance = ? WHERE id = ?';
          conn.query(updateSql, [newBalance, userId], (updateErr) => {
            if (updateErr) {
              return conn.rollback(() => {
                conn.release();
                callback(updateErr);
              });
            }
            
            // Record transaction
            const recordSql = `
              INSERT INTO wallet_transactions 
              (userId, type, amount, balance_before, balance_after, description, reference)
              VALUES (?, 'purchase', ?, ?, ?, ?, ?)
            `;
            conn.query(recordSql, [userId, amount, currentBalance, newBalance, description, reference], (recordErr) => {
              if (recordErr) {
                return conn.rollback(() => {
                  conn.release();
                  callback(recordErr);
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
                callback(null, newBalance);
              });
            });
          });
        });
      });
    });
  }

  /**
   * Add refund to wallet
   */
  static refund(userId, amount, description, reference, callback) {
    this.getBalance(userId, (err, currentBalance) => {
      if (err) return callback(err);
      
      const newBalance = currentBalance + parseFloat(amount);
      
      connection.getConnection((connErr, conn) => {
        if (connErr) return callback(connErr);
        
        conn.beginTransaction((transErr) => {
          if (transErr) {
            conn.release();
            return callback(transErr);
          }
          
          // Update user balance
          const updateSql = 'UPDATE users SET wallet_balance = ? WHERE id = ?';
          conn.query(updateSql, [newBalance, userId], (updateErr) => {
            if (updateErr) {
              return conn.rollback(() => {
                conn.release();
                callback(updateErr);
              });
            }
            
            // Record transaction
            const recordSql = `
              INSERT INTO wallet_transactions 
              (userId, type, amount, balance_before, balance_after, description, reference)
              VALUES (?, 'refund', ?, ?, ?, ?, ?)
            `;
            conn.query(recordSql, [userId, amount, currentBalance, newBalance, description, reference], (recordErr) => {
              if (recordErr) {
                return conn.rollback(() => {
                  conn.release();
                  callback(recordErr);
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
                callback(null, newBalance);
              });
            });
          });
        });
      });
    });
  }

  /**
   * Admin credit to wallet
   */
  static adminCredit(userId, amount, description, adminId, callback) {
    this.deposit(userId, amount, description, `ADMIN_${adminId}`, callback);
  }

  /**
   * Admin debit from wallet
   */
  static adminDebit(userId, amount, description, adminId, callback) {
    this.getBalance(userId, (err, currentBalance) => {
      if (err) return callback(err);
      
      const newBalance = currentBalance - parseFloat(amount);
      
      connection.getConnection((connErr, conn) => {
        if (connErr) return callback(connErr);
        
        conn.beginTransaction((transErr) => {
          if (transErr) {
            conn.release();
            return callback(transErr);
          }
          
          // Update user balance
          const updateSql = 'UPDATE users SET wallet_balance = ? WHERE id = ?';
          conn.query(updateSql, [newBalance, userId], (updateErr) => {
            if (updateErr) {
              return conn.rollback(() => {
                conn.release();
                callback(updateErr);
              });
            }
            
            // Record transaction
            const recordSql = `
              INSERT INTO wallet_transactions 
              (userId, type, amount, balance_before, balance_after, description, reference)
              VALUES (?, 'admin_debit', ?, ?, ?, ?, ?)
            `;
            conn.query(recordSql, [userId, amount, currentBalance, newBalance, description, `ADMIN_${adminId}`], (recordErr) => {
              if (recordErr) {
                return conn.rollback(() => {
                  conn.release();
                  callback(recordErr);
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
                callback(null, newBalance);
              });
            });
          });
        });
      });
    });
  }

  /**
   * Get user's transaction history
   */
  static getTransactions(userId, limit = 50, callback) {
    const sql = `
      SELECT * FROM wallet_transactions 
      WHERE userId = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    connection.query(sql, [userId, limit], (err, results) => {
      if (err) return callback(err);
      // Parse numeric values
      const transactions = results.map(t => ({
        ...t,
        amount: parseFloat(t.amount),
        balance_before: parseFloat(t.balance_before),
        balance_after: parseFloat(t.balance_after)
      }));
      callback(null, transactions);
    });
  }

  /**
   * Get all transactions (admin)
   */
  static getAllTransactions(limit = 100, callback) {
    const sql = `
      SELECT wt.*, u.username, u.email 
      FROM wallet_transactions wt
      LEFT JOIN users u ON wt.userId = u.id
      ORDER BY wt.created_at DESC 
      LIMIT ?
    `;
    connection.query(sql, [limit], (err, results) => {
      if (err) return callback(err);
      const transactions = results.map(t => ({
        ...t,
        amount: parseFloat(t.amount),
        balance_before: parseFloat(t.balance_before),
        balance_after: parseFloat(t.balance_after)
      }));
      callback(null, transactions);
    });
  }
}

module.exports = Wallet;
