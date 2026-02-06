require('dotenv').config();
const db = require('../db');

console.log('Setting up wallet system...');

// Add wallet_balance to users table
const addWalletBalanceColumn = `
ALTER TABLE users 
ADD COLUMN wallet_balance DECIMAL(10, 2) DEFAULT 0.00
`;

// Create wallet_transactions table
const createWalletTransactionsTable = `
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('deposit', 'purchase', 'refund', 'admin_credit', 'admin_debit') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
`;

db.query(addWalletBalanceColumn, (err1) => {
  if (err1) {
    if (err1.code === 'ER_DUP_FIELDNAME') {
      console.log('✓ wallet_balance column already exists in users table');
    } else {
      console.error('Error adding wallet_balance column:', err1);
      console.log('Continuing anyway...');
    }
  } else {
    console.log('✓ Added wallet_balance column to users table');
  }
  
  db.query(createWalletTransactionsTable, (err2) => {
    if (err2) {
      console.error('Error creating wallet_transactions table:', err2);
      process.exit(1);
    }
    
    console.log('✓ Created wallet_transactions table');
    console.log('\n🎉 Wallet system database setup complete!');
    console.log('Users now have wallet balances and all transactions will be tracked.');
    process.exit(0);
  });
});
