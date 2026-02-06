require('dotenv').config();
const db = require('../db');

console.log('Setting up seller functionality...\n');

const migrations = [
  // 1. Add is_seller column to users table
  {
    name: 'Add is_seller to users',
    sql: `ALTER TABLE users ADD COLUMN is_seller BOOLEAN DEFAULT FALSE`
  },
  
  // 2. Add seller_status column (pending, approved, suspended)
  {
    name: 'Add seller_status to users',
    sql: `ALTER TABLE users ADD COLUMN seller_status ENUM('pending', 'approved', 'suspended') DEFAULT NULL`
  },
  
  // 3. Add seller_approved_at timestamp
  {
    name: 'Add seller_approved_at to users',
    sql: `ALTER TABLE users ADD COLUMN seller_approved_at TIMESTAMP NULL DEFAULT NULL`
  },
  
  // 4. Add seller_id column to products table to track which seller owns each vehicle
  {
    name: 'Add seller_id to products',
    sql: `ALTER TABLE products ADD COLUMN seller_id INT DEFAULT NULL`
  },
  
  // 5. Add foreign key for seller_id (separate from ADD COLUMN)
  {
    name: 'Add seller_id foreign key',
    sql: `ALTER TABLE products ADD CONSTRAINT fk_products_seller 
          FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL`
  },
  
  // 6. Create seller_profile table for additional seller information
  {
    name: 'Create seller_profile table',
    sql: `CREATE TABLE IF NOT EXISTS seller_profile (
      profile_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      business_name VARCHAR(255),
      business_phone VARCHAR(20),
      business_address TEXT,
      business_description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  }
];

let completed = 0;
const errors = [];

migrations.forEach((migration, idx) => {
  db.query(migration.sql, (err) => {
    if (err) {
      // Ignore duplicate column/key errors as they mean the column already exists
      if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_KEYNAME') {
        console.error(`✗ ${migration.name} failed:`, err.message);
        errors.push({ migration: migration.name, error: err.message });
      } else {
        console.log(`✓ ${migration.name} (already exists)`);
      }
    } else {
      console.log(`✓ ${migration.name}`);
    }
    completed++;
    
    if (completed === migrations.length) {
      console.log('\n--- Migration Summary ---');
      console.log(`Completed: ${migrations.length - errors.length}/${migrations.length}`);
      
      if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach(e => console.log(`  - ${e.migration}: ${e.error}`));
      }
      
      console.log('\n✅ Seller functionality setup complete!');
      console.log('\nYou can now:');
      console.log('  - Allow users to register as sellers');
      console.log('  - Sellers can list vehicles for sale');
      console.log('  - Admin can approve/suspend sellers');
      process.exit(0);
    }
  });
});
