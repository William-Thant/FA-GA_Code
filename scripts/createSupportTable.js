require('dotenv').config();
const db = require('../db');

console.log('Creating support tickets table...\n');

const createTableSQL = `
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('open', 'in-progress', 'resolved', 'closed') DEFAULT 'open',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    admin_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )
`;

db.query(createTableSQL, (err) => {
  if (err) {
    console.error('✗ Failed to create support_tickets table:', err.message);
    process.exit(1);
  } else {
    console.log('✓ support_tickets table created successfully!');
    console.log('\n✅ Migration complete!');
    process.exit(0);
  }
});
