const db = require('./db');

db.query('SELECT id, productName, image FROM products LIMIT 10', (error, results) => {
    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }
    
    console.log('Products in database:');
    console.log('='.repeat(80));
    results.forEach(product => {
        console.log(`ID: ${product.id} | Name: ${product.productName} | Image: ${product.image || 'NULL'}`);
    });
    console.log('='.repeat(80));
    
    process.exit(0);
});
