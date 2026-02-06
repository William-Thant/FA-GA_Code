require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
    console.log('✅ Connected to database');
    
    // Reset all wallet data
    console.log('🗑️  Resetting wallet data...');
    
    // Delete all wallet transactions
    db.query('DELETE FROM wallet_transactions', (err) => {
        if (err) {
            console.error('❌ Error deleting wallet_transactions:', err);
            db.end();
            process.exit(1);
        }
        console.log('✅ Deleted all wallet transactions');
        
        // Reset all user wallet balances to 0
        db.query('UPDATE users SET wallet_balance = 0.00', (err) => {
            if (err) {
                console.error('❌ Error resetting wallet balances:', err);
                db.end();
                process.exit(1);
            }
            console.log('✅ Reset all wallet balances to $0.00');
            console.log('✅ All wallet data has been cleared!');
            
            db.end();
            process.exit(0);
        });
    });
});
