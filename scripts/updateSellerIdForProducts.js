require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');

    // Check how many products have NULL seller_id
    connection.query('SELECT COUNT(*) as count FROM products WHERE seller_id IS NULL', (err, results) => {
        if (err) throw err;
        console.log(`\n📊 Products without seller_id: ${results[0].count}`);

        // Get all products with NULL seller_id
        connection.query('SELECT id, productName, seller_id FROM products WHERE seller_id IS NULL LIMIT 10', (err, results) => {
            if (err) throw err;
            
            if (results.length > 0) {
                console.log('\n📝 Sample products without seller_id:');
                results.forEach(product => {
                    console.log(`  - ID: ${product.id}, Name: ${product.productName}, seller_id: ${product.seller_id}`);
                });

                console.log('\n💡 Solution:');
                console.log('   1. Have sellers log in and add their own vehicles');
                console.log('   2. OR manually assign seller_id to test products (see examples below)\n');

                // Show an example of how to update
                console.log('📌 Example SQL to assign a seller_id:');
                console.log('   UPDATE products SET seller_id = 16 WHERE id = 1;  -- Assign to seller user_id 16');
                console.log('   (You can also batch update: UPDATE products SET seller_id = 16 WHERE seller_id IS NULL LIMIT 5;)\n');
            }

            // Show sellers that exist
            connection.query('SELECT id, username, is_seller, seller_status FROM users WHERE is_seller = 1', (err, sellers) => {
                if (err) throw err;
                
                if (sellers.length > 0) {
                    console.log('👥 Available sellers in system:');
                    sellers.forEach(seller => {
                        console.log(`  - ID: ${seller.id}, Name: ${seller.username}, Status: ${seller.seller_status}`);
                    });
                }

                // Show products that DO have seller_id
                connection.query('SELECT COUNT(*) as count FROM products WHERE seller_id IS NOT NULL', (err, results) => {
                    if (err) throw err;
                    console.log(`\n✅ Products with seller_id (will track views): ${results[0].count}`);

                    connection.end();
                    console.log('\n✨ Fix: Add seller_id to products so views can be tracked!\n');
                });
            });
        });
    });
});
