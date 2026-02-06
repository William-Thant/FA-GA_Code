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
    
    // Delete all old orders and order items
    console.log('🗑️  Deleting old supermarket orders...');
    
    db.query('DELETE FROM order_items', (err) => {
        if (err) {
            console.error('❌ Error deleting order_items:', err);
            db.end();
            process.exit(1);
        }
        console.log('✅ Deleted all order items');
        
        db.query('DELETE FROM orders', (err) => {
            if (err) {
                console.error('❌ Error deleting orders:', err);
                db.end();
                process.exit(1);
            }
            console.log('✅ Deleted all orders');
            console.log('✅ All old supermarket receipts have been cleared!');
            
            db.end();
            process.exit(0);
        });
    });
});
