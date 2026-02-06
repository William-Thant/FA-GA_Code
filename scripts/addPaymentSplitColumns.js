require('dotenv').config();
const db = require('../db');

// Add seller_earnings and admin_commission columns to orders table
const alterOrdersTable = `
ALTER TABLE orders 
ADD COLUMN seller_earnings DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN admin_commission DECIMAL(10, 2) DEFAULT 0
`;

db.query(alterOrdersTable, (err) => {
    if (err) {
        // If columns already exist, that's fine - continue
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('✓ Columns already exist, skipping column creation');
        } else {
            console.error('Error altering orders table:', err);
            process.exit(1);
        }
    } else {
        console.log('✓ orders table updated with seller_earnings and admin_commission columns');
    }
    
    // Update existing orders to calculate the 90/10 split if they don't have values
    const updateOrdersSql = `
        UPDATE orders 
        SET seller_earnings = ROUND(total * 0.90, 2),
            admin_commission = ROUND(total * 0.10, 2)
        WHERE seller_earnings = 0 AND admin_commission = 0 AND total > 0
    `;
    
    db.query(updateOrdersSql, (updateErr) => {
        if (updateErr) {
            console.error('Error updating existing orders:', updateErr);
            process.exit(1);
        }
        console.log('✓ Existing orders updated with payment split');
        console.log('\n✅ Payment split migration completed!');
        process.exit(0);
    });
});
