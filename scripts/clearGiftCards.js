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
    
    // Delete all gift card data (transactions first due to foreign key)
    console.log('🗑️  Deleting all gift card data...');
    
    // First delete transactions
    db.query('DELETE FROM gift_card_transactions', (err) => {
        if (err) {
            console.error('❌ Error deleting gift card transactions:', err);
            db.end();
            process.exit(1);
        }
        console.log('✅ Deleted all gift card transactions');
        
        // Then delete gift cards
        db.query('DELETE FROM gift_cards', (err) => {
            if (err) {
                console.error('❌ Error deleting gift cards:', err);
                db.end();
                process.exit(1);
            }
            console.log('✅ Deleted all gift cards');
            console.log('✅ All gift card data has been cleared!');
            
            db.end();
            process.exit(0);
        });
    });
});
