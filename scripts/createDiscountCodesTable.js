require('dotenv').config();
const db = require('../db');

const createDiscountCodesTable = `
CREATE TABLE IF NOT EXISTS discount_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  value DECIMAL(10, 2) NOT NULL,
  minPurchase DECIMAL(10, 2) DEFAULT 0,
  maxUses INT DEFAULT NULL,
  usedCount INT DEFAULT 0,
  expiryDate DATETIME DEFAULT NULL,
  active BOOLEAN DEFAULT 1,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_active (active)
);
`;

const insertSampleDiscounts = `
INSERT INTO discount_codes (code, type, value, minPurchase, maxUses, expiryDate, active) VALUES
('WELCOME10', 'percentage', 10.00, 0, NULL, '2026-12-31 23:59:59', 1),
('SAVE5', 'fixed', 5.00, 20.00, 100, '2026-06-30 23:59:59', 1),
('BULK20', 'percentage', 20.00, 50.00, 50, '2026-12-31 23:59:59', 1),
('FIRSTORDER', 'percentage', 15.00, 0, 1000, '2026-12-31 23:59:59', 1),
('FREESHIP', 'fixed', 3.00, 30.00, NULL, '2026-12-31 23:59:59', 1)
ON DUPLICATE KEY UPDATE code=code;
`;

console.log('Creating discount_codes table...');

db.query(createDiscountCodesTable, (err, result) => {
  if (err) {
    console.error('Error creating discount_codes table:', err);
    process.exit(1);
  }
  
  console.log('✓ discount_codes table created successfully');
  console.log('Inserting sample discount codes...');
  
  db.query(insertSampleDiscounts, (err2, result2) => {
    if (err2) {
      console.error('Error inserting sample discounts:', err2);
      process.exit(1);
    }
    
    console.log('✓ Sample discount codes inserted successfully');
    console.log('\nSample Discount Codes:');
    console.log('  WELCOME10  - 10% off any purchase');
    console.log('  SAVE5      - $5 off orders $20+');
    console.log('  BULK20     - 20% off orders $50+');
    console.log('  FIRSTORDER - 15% off first order');
    console.log('  FREESHIP   - $3 off orders $30+ (covers shipping)');
    console.log('\nAll discount codes expire on Dec 31, 2026');
    
    db.end();
    process.exit(0);
  });
});
