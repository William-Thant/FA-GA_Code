const db = require('./db');

// Update all products that have default-car.jpg to use default-car.svg
db.query("UPDATE products SET image = 'default-car.svg' WHERE image = 'default-car.jpg'", (error, results) => {
    if (error) {
        console.error('Error updating images:', error);
        process.exit(1);
    }
    
    console.log(`Successfully updated ${results.affectedRows} product image references`);
    
    // Verify the update
    db.query('SELECT id, productName, image FROM products LIMIT 10', (error, products) => {
        if (error) {
            console.error('Error verifying:', error);
            process.exit(1);
        }
        
        console.log('\nUpdated products:');
        console.log('='.repeat(80));
        products.forEach(p => {
            console.log(`ID: ${p.id} | Name: ${p.productName} | Image: ${p.image}`);
        });
        console.log('='.repeat(80));
        
        process.exit(0);
    });
});
