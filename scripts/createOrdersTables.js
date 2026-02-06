require('dotenv').config();
const db = require('../db');

console.log('Creating orders tables...\n');

const migrations = [
  // 1. Create orders table
  {
    name: 'Create orders table',
    sql: `CREATE TABLE IF NOT EXISTS orders (
      orderId VARCHAR(50) PRIMARY KEY,
      userId INT NOT NULL,
      subtotal DECIMAL(10, 2) NOT NULL,
      tax DECIMAL(10, 2) NOT NULL,
      total DECIMAL(10, 2) NOT NULL,
      orderDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`
  },
  
  // 2. Create order_items table
  {
    name: 'Create order_items table',
    sql: `CREATE TABLE IF NOT EXISTS order_items (
      itemId INT AUTO_INCREMENT PRIMARY KEY,
      orderId VARCHAR(50) NOT NULL,
      productId INT NOT NULL,
      productName VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY (orderId) REFERENCES orders(orderId) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )`
  }
];

async function runMigrations() {
  for (const migration of migrations) {
    console.log(`Running: ${migration.name}...`);
    try {
      await new Promise((resolve, reject) => {
        db.query(migration.sql, (err, result) => {
          if (err) {
            console.error(`Error in ${migration.name}:`, err.message);
            reject(err);
          } else {
            console.log(`✓ ${migration.name} completed`);
            resolve(result);
          }
        });
      });
    } catch (err) {
      console.error(`Failed to run ${migration.name}`);
      process.exit(1);
    }
  }
  
  console.log('\n✓ All migrations completed successfully!');
  process.exit(0);
}

runMigrations();
