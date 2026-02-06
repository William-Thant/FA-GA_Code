require('dotenv').config();
const db = require('../db');

console.log('Fixing orders with invalid refundedAmount values...');

// First, check for problematic values
const checkSql = `
SELECT orderId, refundedAmount, total 
FROM orders 
WHERE refundedAmount IS NOT NULL AND refundedAmount != '0.00'
`;

db.query(checkSql, (err, results) => {
  if (err) {
    console.error('Error checking orders:', err);
    process.exit(1);
  }
  
  if (results.length === 0) {
    console.log('No orders with refunded amounts found.');
    process.exit(0);
  }
  
  console.log(`Found ${results.length} orders with refunded amounts:`);
  results.forEach(order => {
    console.log(`  Order ${order.orderId}: refundedAmount = ${order.refundedAmount}, total = ${order.total}`);
  });
  
  console.log('\nResetting all refunded amounts to 0...');
  
  const resetSql = `
  UPDATE orders 
  SET refundedAmount = 0.00, refundStatus = 'none'
  WHERE refundedAmount IS NOT NULL
  `;
  
  db.query(resetSql, (resetErr, result) => {
    if (resetErr) {
      console.error('Error resetting refunded amounts:', resetErr);
      process.exit(1);
    }
    
    console.log(`✓ Reset ${result.affectedRows} orders`);
    console.log('All refunded amounts have been reset. You can now test refunds again.');
    process.exit(0);
  });
});
