require('dotenv').config();
const db = require('./db');

db.query('DESCRIBE order_items', (err, results) => {
    if (err) {
        console.error('Error checking order_items table:', err.message);
        console.log('Table may not exist');
    } else {
        console.log('Order_items table structure:');
        console.log('='.repeat(80));
        results.forEach(row => {
            console.log(`${row.Field.padEnd(25)} | ${row.Type.padEnd(20)} | Null: ${row.Null.padEnd(3)} | Key: ${row.Key.padEnd(3)} | Default: ${row.Default}`);
        });
        console.log('='.repeat(80));
    }
    process.exit(0);
});
