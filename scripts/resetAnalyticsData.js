const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cardealership_db'
});

connection.connect((err) => {
  if (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
});

// Reset analytics data by clearing orders table (handle foreign keys)
const resetQueries = [
  'DELETE FROM order_items',  // Delete order items first (foreign key dependency)
  'DELETE FROM orders',        // Then delete orders
  'UPDATE products SET quantity = 10 WHERE 1=1'  // Reset product quantities
];

let completed = 0;

resetQueries.forEach((query, index) => {
  connection.query(query, (err, results) => {
    if (err) {
      console.error(`Query ${index + 1} failed:`, err.message);
    } else {
      console.log(`✓ Query ${index + 1} completed successfully`);
      completed++;
    }
    
    if (completed === resetQueries.length) {
      console.log('\n✅ Analytics data reset completed!');
      console.log('- Order items cleared');
      console.log('- Orders table cleared');
      console.log('- Product quantities reset to 10');
      connection.end();
    }
  });
});
