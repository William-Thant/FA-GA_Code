const db = require('../db');

// Create refund_requests table
const createRefundRequestsTable = `
CREATE TABLE IF NOT EXISTS refund_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(50) NOT NULL,
    product_id INT NOT NULL,
    customer_id INT NOT NULL,
    seller_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    admin_commission DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
    restore_inventory BOOLEAN DEFAULT false,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    processed_by INT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(orderId),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
)`;

// Create admin_revenue table to track commission
const createAdminRevenueTable = `
CREATE TABLE IF NOT EXISTS admin_revenue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(50) NOT NULL,
    seller_id INT NOT NULL,
    sale_amount DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    commission_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(orderId),
    FOREIGN KEY (seller_id) REFERENCES users(id)
)`;

db.query(createRefundRequestsTable, (err) => {
    if (err) {
        console.error('Error creating refund_requests table:', err);
        process.exit(1);
    }
    console.log('✓ refund_requests table created successfully');

    db.query(createAdminRevenueTable, (err2) => {
        if (err2) {
            console.error('Error creating admin_revenue table:', err2);
            process.exit(1);
        }
        console.log('✓ admin_revenue table created successfully');
        console.log('\n✅ Marketplace refund system migration completed!');
        process.exit(0);
    });
});
