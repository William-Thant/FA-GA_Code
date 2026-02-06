const db = require('../db');

console.log('💰 Updating car prices to under $5,000 for testing...\n');

const updateQuery = `
  UPDATE products 
  SET price = CASE 
    WHEN productName LIKE '%Tesla Model 3%' THEN 4999
    WHEN productName LIKE '%BMW M3%' THEN 4899
    WHEN productName LIKE '%Ford F-150%' THEN 4799
    WHEN productName LIKE '%Mercedes%' THEN 4699
    WHEN productName LIKE '%Toyota Camry%' THEN 3999
    WHEN productName LIKE '%Porsche 911%' THEN 4999
    WHEN productName LIKE '%Honda CR-V%' THEN 4599
    WHEN productName LIKE '%Audi e-tron%' THEN 4799
    WHEN productName LIKE '%Chevrolet Silverado%' THEN 4499
    WHEN productName LIKE '%Mazda%' THEN 3799
    WHEN productName LIKE '%Lexus RX%' THEN 4699
    WHEN productName LIKE '%Jeep Wrangler%' THEN 4599
    ELSE price 
  END
  WHERE productName LIKE '%202%'
`;

db.query(updateQuery, (err, result) => {
  if (err) {
    console.error('❌ Error updating prices:', err.message);
    process.exit(1);
  }
  
  console.log(`✅ Successfully updated ${result.affectedRows} car prices!`);
  console.log('All cars are now priced under $5,000 for testing.\n');
  process.exit(0);
});
