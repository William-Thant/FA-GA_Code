const db = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 10;

const User = {
    getAll(callback){
        // Return all users with username as their display name
        db.query('SELECT id as userId, username as name, email, role FROM users', callback);
    },

    // Supports bcrypt hashes and legacy SHA1 hashes.
    // If a legacy SHA1 match is found, the password will be re-hashed with bcrypt and updated in the DB.
    getByCredentials(email, password, callback) {
        db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
            if (err) return callback(err);
            const row = results && results.length ? results[0] : null;
            if (!row) return callback(null, null);

            const stored = row.password || '';

            // If stored password looks like a bcrypt hash (starts with $2), use bcrypt.compare
            if (stored.startsWith('$2')) {
                bcrypt.compare(password, stored, (cmpErr, match) => {
                    if (cmpErr) return callback(cmpErr);
                    if (!match) return callback(null, null);
                    delete row.password;
                    callback(null, row);
                });
                return;
            }

            // Otherwise assume legacy SHA1 and compare
            const sha1 = crypto.createHash('sha1').update(password).digest('hex');
            if (sha1 === stored) {
                // Migrate to bcrypt silently
                bcrypt.hash(password, SALT_ROUNDS, (hashErr, newHash) => {
                    if (!hashErr) {
                        // try to update password to bcrypt hash; ignore errors
                        const idField = row.userId ? 'userId' : (row.id ? 'id' : null);
                        const idVal = idField ? row[idField] : null;
                        if (idField && idVal) {
                            db.query('UPDATE users SET password = ? WHERE ' + idField + ' = ?', [newHash, idVal], () => {});
                        }
                    }
                    delete row.password;
                    callback(null, row);
                });
            } else {
                return callback(null, null);
            }
        });
    },

};

module.exports = User;
