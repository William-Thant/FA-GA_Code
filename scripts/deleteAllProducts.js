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

    // First, show all products that will be deleted
    connection.query('SELECT id, productName, seller_id FROM products', (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            console.log(`\n🗑️  Deleting ${results.length} products:\n`);
            results.forEach(product => {
                console.log(`   ❌ ID: ${product.id}, Name: ${product.productName}, Seller: ${product.seller_id}`);
            });

            // First delete related vehicle_views
            connection.query('DELETE FROM vehicle_views WHERE 1=1', (err, result) => {
                if (err) throw err;
                console.log(`\n  ✓ Deleted ${result.affectedRows} vehicle views`);

                // Then delete related daily_view_stats
                connection.query('DELETE FROM daily_view_stats WHERE 1=1', (err, result) => {
                    if (err) throw err;
                    console.log(`  ✓ Deleted ${result.affectedRows} daily view stats`);

                    // Delete all products
                    connection.query('DELETE FROM products', (err, result) => {
                        if (err) throw err;
                        console.log(`  ✓ Deleted ${result.affectedRows} products`);
                        console.log(`\n✅ Successfully cleared all test data!`);
                        console.log('🛒 The /shop route is now empty. You can add new products as a seller.\n');
                        connection.end();
                    });
                });
            });
        } else {
            console.log('\n📭 No products to delete - shop is already empty!\n');
            connection.end();
        }
    });
});
