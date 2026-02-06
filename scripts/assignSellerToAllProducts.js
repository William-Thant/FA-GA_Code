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

    // Update all products without seller_id to use seller_id = 16 (the approved seller)
    connection.query(
        'UPDATE products SET seller_id = 16 WHERE seller_id IS NULL',
        (err, results) => {
            if (err) throw err;
            
            console.log(`✅ Updated ${results.affectedRows} products with seller_id = 16\n`);

            // Verify the update
            connection.query(
                'SELECT COUNT(*) as total_with_seller FROM products WHERE seller_id = 16',
                (err, results) => {
                    if (err) throw err;
                    
                    console.log(`📊 Total products now assigned to seller: ${results[0].total_with_seller}`);
                    console.log('✨ All products are now ready for view tracking!\n');
                    console.log('🎯 When buyers click on any product, views will now be tracked in the seller dashboard.');
                    
                    connection.end();
                }
            );
        }
    );
});
