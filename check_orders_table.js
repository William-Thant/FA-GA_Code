const db = require('./db');

db.query('DESCRIBE orders', (error, results) => {
    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }
    
    console.log('Orders table structure:');
    console.log('='.repeat(80));
    results.forEach(field => {
        console.log(`${field.Field.padEnd(25)} | ${field.Type.padEnd(20)} | Null: ${field.Null.padEnd(3)} | Key: ${field.Key.padEnd(3)} | Default: ${field.Default}`);
    });
    console.log('='.repeat(80));
    
    process.exit(0);
});
