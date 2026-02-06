const db = require('../db');

const CartItems = {
    getByUserId(userId, callback) {
        db.query('SELECT * FROM cart_items WHERE userId = ?', [userId], callback);
    },
    add(userId, fineId, callback) {
        db.query('INSERT INTO cart_items (userId, fineId) VALUES (?, ?)', [userId, fineId], callback);
    },
    remove(userId, fineId, callback) {
        db.query('DELETE FROM cart_items WHERE userId = ? AND fineId = ?', [userId, fineId], callback);
    },
    removeBulk(userId, fineIds, callback) {
        if (!fineIds || !fineIds.length) return callback(null);
        const placeholders = fineIds.map(() => '?').join(',');
        const sql = `DELETE FROM cart_items WHERE userId = ? AND fineId IN (${placeholders})`;
        db.query(sql, [userId, ...fineIds], callback);
    },
    clear(userId, callback) {
        db.query('DELETE FROM cart_items WHERE userId = ?', [userId], callback);
    }
};

module.exports = CartItems;
