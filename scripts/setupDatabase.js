require('dotenv').config();
const db = require('../db');

console.log('Setting up database...\n');

const migrations = [
  // 1. Add category column to products if it doesn't exist
  {
    name: 'Add category column to products',
    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT NULL`
  },
  
  // 2. Create fines table
  {
    name: 'Create fines table',
    sql: `CREATE TABLE IF NOT EXISTS fines (
      fineId INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      fineTypeId INT,
      amount DECIMAL(10, 2) NOT NULL,
      description VARCHAR(255),
      paid BOOLEAN DEFAULT FALSE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
    )`
  },
  
  // 3. Create fine_types table
  {
    name: 'Create fine_types table',
    sql: `CREATE TABLE IF NOT EXISTS fine_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      typeName VARCHAR(100) NOT NULL UNIQUE
    )`
  },
  
  // 4. Create cart_items table for fines
  {
    name: 'Create cart_items table',
    sql: `CREATE TABLE IF NOT EXISTS cart_items (
      cartItemId INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      fineId INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
      FOREIGN KEY (fineId) REFERENCES fines(fineId) ON DELETE CASCADE,
      UNIQUE KEY unique_user_fine (userId, fineId)
    )`
  }
];

let completed = 0;
const errors = [];

migrations.forEach((migration, idx) => {
  db.query(migration.sql, (err) => {
    if (err) {
      console.error(`✗ ${migration.name} failed:`, err.message);
      errors.push({ migration: migration.name, error: err.message });
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
      
      // Seed fine types if table is empty
      db.query('SELECT COUNT(*) as count FROM fine_types', (err, results) => {
        if (!err && results && results[0].count === 0) {
          console.log('\n--- Seeding fine types ---');
          const types = ['Library Fine', 'Parking Violation', 'Late Assignment', 'Disciplinary Fine', 'Other'];
          let seeded = 0;
          types.forEach(type => {
            db.query('INSERT INTO fine_types (typeName) VALUES (?)', [type], (err) => {
              if (!err) console.log(`✓ Added: ${type}`);
              seeded++;
              if (seeded === types.length) {
                console.log('\nDatabase setup complete!');
                process.exit(0);
              }
            });
          });
        } else {
          console.log('\nDatabase setup complete!');
          process.exit(0);
        }
      });
    }
  });
});
