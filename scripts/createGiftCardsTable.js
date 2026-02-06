const db = require('../db');

const createGiftCardsTable = `
  CREATE TABLE IF NOT EXISTS gift_cards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) UNIQUE NOT NULL,
    initialAmount DECIMAL(10,2) NOT NULL,
    currentBalance DECIMAL(10,2) NOT NULL,
    purchasedBy INT,
    recipientEmail VARCHAR(255),
    recipientName VARCHAR(100),
    message TEXT,
    status ENUM('active', 'redeemed', 'expired') DEFAULT 'active',
    expiryDate DATETIME,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redeemedAt DATETIME,
    redeemedBy INT,
    FOREIGN KEY (purchasedBy) REFERENCES users(id),
    FOREIGN KEY (redeemedBy) REFERENCES users(id),
    INDEX idx_code (code),
    INDEX idx_status (status)
  )
`;

const createGiftCardTransactionsTable = `
  CREATE TABLE IF NOT EXISTS gift_card_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    giftCardId INT NOT NULL,
    transactionType ENUM('purchase', 'redemption', 'partial_use') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balanceBefore DECIMAL(10,2) NOT NULL,
    balanceAfter DECIMAL(10,2) NOT NULL,
    orderId VARCHAR(100),
    userId INT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (giftCardId) REFERENCES gift_cards(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`;

console.log('Creating gift cards tables...');

db.query(createGiftCardsTable, (err) => {
  if (err) {
    console.error('Error creating gift_cards table:', err);
    process.exit(1);
  }
  console.log('✓ gift_cards table created successfully');
  
  db.query(createGiftCardTransactionsTable, (err) => {
    if (err) {
      console.error('Error creating gift_card_transactions table:', err);
      process.exit(1);
    }
    console.log('✓ gift_card_transactions table created successfully');
    console.log('\nGift cards database setup complete!');
    process.exit(0);
  });
});
