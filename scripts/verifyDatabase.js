require('dotenv').config();
const db = require('../db');

console.log('Verifying database setup...\n');

db.query('SELECT COUNT(*) as count FROM fine_types', (e, r) => {
  console.log('✓ fine_types table:', e ? `ERROR: ${e.message}` : `${r[0].count} types`);
  
  db.query('SHOW COLUMNS FROM products WHERE Field = "category"', (e2, r2) => {
    console.log('✓ products.category:', r2 && r2.length ? 'exists' : 'missing');
    
    db.query('SELECT COUNT(*) as count FROM fines', (e3, r3) => {
      console.log('✓ fines table:', e3 ? `ERROR: ${e3.message}` : `${r3[0].count} records`);
      console.log('\nAll checks complete. You can now access /admin/dashboard');
      process.exit(0);
    });
  });
});
