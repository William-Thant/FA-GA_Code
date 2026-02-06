require('dotenv').config();
const db = require('../db');

// Create product_deletion_log table to track deletions
const createDeletionLogTable = `
CREATE TABLE IF NOT EXISTS product_deletion_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    deleted_by_admin INT NOT NULL,
    deletion_reason VARCHAR(50) NOT NULL,
    deletion_details TEXT,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deleted_by_admin) REFERENCES users(id),
    INDEX idx_product_id (product_id),
    INDEX idx_deleted_at (deleted_at)
)
`;

db.query(createDeletionLogTable, (err) => {
    if (err) {
        console.error('Error creating product_deletion_log table:', err);
        process.exit(1);
    }
    console.log('✓ product_deletion_log table created successfully');
    console.log('\n✅ Product deletion log migration completed!');
    process.exit(0);
});
