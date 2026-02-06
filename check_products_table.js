require('dotenv').config();
const db = require('./db');

db.query('DESCRIBE products', (err, results) => {
    if (err) {
        console.error('Error:', err.message);
    } else {
        console.log('Products table structure:');
        console.log('='.repeat(80));
        results.forEach(row => {
            console.log(`${row.Field.padEnd(25)} | ${row.Type.padEnd(20)} | Null: ${row.Null.padEnd(3)} | Key: ${row.Key.padEnd(3)} | Default: ${row.Default}`);
        });
        console.log('='.repeat(80));
    }
    process.exit(0);
});
