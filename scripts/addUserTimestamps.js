require('dotenv').config();
const db = require('../db');

console.log('Adding timestamp columns to users table...\n');

// First check if columns exist
db.query('SHOW COLUMNS FROM users LIKE "created_at"', (err, results) => {
  if (err) {
    console.error('Error checking for created_at column:', err.message);
    process.exit(1);
  }
  
  if (results.length === 0) {
    // Column doesn't exist, add it
    db.query('ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', (err) => {
      if (err) {
        console.error('✗ Failed to add created_at column:', err.message);
      } else {
        console.log('✓ Added created_at column to users');
      }
      
      // Check for updated_at column
      checkUpdatedAt();
    });
  } else {
    console.log('ℹ created_at column already exists');
    checkUpdatedAt();
  }
});

function checkUpdatedAt() {
  db.query('SHOW COLUMNS FROM users LIKE "updated_at"', (err, results) => {
    if (err) {
      console.error('Error checking for updated_at column:', err.message);
      process.exit(1);
    }
    
    if (results.length === 0) {
      // Column doesn't exist, add it
      db.query('ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', (err) => {
        if (err) {
          console.error('✗ Failed to add updated_at column:', err.message);
          process.exit(1);
        } else {
          console.log('✓ Added updated_at column to users');
          console.log('\n✅ Migration complete!');
          process.exit(0);
        }
      });
    } else {
      console.log('ℹ updated_at column already exists');
      console.log('\n✅ All columns present!');
      process.exit(0);
    }
  });
}

