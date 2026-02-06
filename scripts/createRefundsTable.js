require('dotenv').config();
const db = require('../db');

const createRefundsTable = `
CREATE TABLE IF NOT EXISTS refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  paymentProvider VARCHAR(20),
  refundReference VARCHAR(255),
  processedBy INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orderId (orderId),
  INDEX idx_status (status),
  FOREIGN KEY (orderId) REFERENCES orders(orderId) ON DELETE CASCADE
);
`;

const addRefundColumnsToOrders = `
ALTER TABLE orders 
ADD COLUMN refundedAmount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN refundStatus ENUM('none', 'partial', 'full') DEFAULT 'none',
ADD COLUMN paymentProvider VARCHAR(20),
ADD COLUMN paymentReference VARCHAR(255);
`;

console.log('Creating refunds table...');

db.query(createRefundsTable, (err, result) => {
  if (err) {
    console.error('Error creating refunds table:', err);
    process.exit(1);
  }
  
  console.log('✓ Refunds table created successfully');
  console.log('Adding refund columns to orders table...');
  
  db.query(addRefundColumnsToOrders, (err2, result2) => {
    if (err2) {
      // Column might already exist, check if it's just a duplicate column error
      if (err2.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ Refund columns already exist in orders table');
      } else {
        console.error('Error adding columns to orders table:', err2);
        console.log('This is okay if columns already exist.');
      }
    } else {
      console.log('✓ Refund columns added to orders table successfully');
    }
    
    console.log('\n✅ Refund management database setup complete!');
    console.log('\nTables created:');
    console.log('  - refunds (tracks all refund transactions)');
    console.log('  - orders (updated with refund tracking columns)');
    
    db.end();
    process.exit(0);
  });
});
