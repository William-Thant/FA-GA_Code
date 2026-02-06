require('dotenv').config();
const db = require('../db');

console.log('Cleaning up old orders without payment information...');

// Delete old orders that don't have payment provider information
const deleteOldOrders = `
DELETE FROM orders 
WHERE paymentProvider IS NULL OR paymentReference IS NULL
`;

db.query(deleteOldOrders, (err, result) => {
  if (err) {
    console.error('Error deleting old orders:', err);
    process.exit(1);
  }
  
  console.log(`✓ Deleted ${result.affectedRows} old orders without payment information`);
  console.log('All future orders will now include payment tracking for refunds.');
  process.exit(0);
});
