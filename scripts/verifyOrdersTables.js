require('dotenv').config();
const db = require('../db');

console.log('Checking if orders tables exist...\n');

// Check orders table
db.query('SHOW TABLES LIKE "orders"', (err, result) => {
    if (err) {
        console.error('Error checking orders table:', err);
    } else if (result.length > 0) {
        console.log('✓ orders table exists');
        db.query('DESCRIBE orders', (err, desc) => {
            if (!err) {
                console.log('  Columns:', desc.map(col => col.Field).join(', '));
            }
        });
    } else {
        console.log('✗ orders table does not exist - need to run createOrdersTables.js');
    }
    
    // Check order_items table
    db.query('SHOW TABLES LIKE "order_items"', (err, result) => {
        if (err) {
            console.error('Error checking order_items table:', err);
        } else if (result.length > 0) {
            console.log('✓ order_items table exists');
            db.query('DESCRIBE order_items', (err, desc) => {
                if (!err) {
                    console.log('  Columns:', desc.map(col => col.Field).join(', '));
                }
                setTimeout(() => process.exit(0), 500);
            });
        } else {
            console.log('✗ order_items table does not exist - need to run createOrdersTables.js');
            setTimeout(() => process.exit(0), 500);
        }
    });
});
