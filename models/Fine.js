const db = require('../db');

const Fine = {

    getByIds(ids, callback) {
        if (!ids || !ids.length) return callback(null, []);
        const placeholders = ids.map(() => '?').join(',');
        db.query(`SELECT * FROM fines WHERE fineId IN (${placeholders})`, ids, callback);
    },
    markPaid(ids, callback) {
        if (!ids || !ids.length) return callback(null);
        const placeholders = ids.map(() => '?').join(',');
        db.query(`UPDATE fines SET paid = 1 WHERE fineId IN (${placeholders})`, ids, callback);
    },
    addFine(fine, callback) {
        db.query(
            'INSERT INTO fines (userId, fineTypeId, amount, description, paid) VALUES (?, ?, ?, ?, ?)',
            [fine.userId, fine.fineTypeId, fine.amount, fine.description, fine.paid],
            callback
        );
    },
    getFineTypes(callback) {
        db.query('SELECT * FROM fine_types', callback);
    },
    getAllWithUser(callback) {
        db.query(`
            SELECT f.*, u.username AS userName, ft.typeName
            FROM fines f
            JOIN users u ON f.userId = u.id
            LEFT JOIN fine_types ft ON f.fineTypeId = ft.id
        `, callback);
    },
    getAllWithUserAndType(callback) {
        db.query(`
            SELECT f.*, u.username AS userName, ft.typeName
            FROM fines f
            JOIN users u ON f.userId = u.id
            LEFT JOIN fine_types ft ON f.fineTypeId = ft.id
        `, callback);
    },
    getByUserIdWithType(userId, callback) {
        db.query(`
            SELECT f.*, ft.typeName
            FROM fines f
            LEFT JOIN fine_types ft ON f.fineTypeId = ft.id
            WHERE f.userId = ?
        `, [userId], callback);
    }
};

module.exports = Fine;
