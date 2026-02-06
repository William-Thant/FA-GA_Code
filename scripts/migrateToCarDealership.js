const db = require('../db');

console.log('🚗 Migrating database to Car Dealership schema...\n');

// Step 1: Add new columns for car-specific attributes (check if they don't exist first)
const checkAndAddColumns = () => {
  return new Promise((resolve, reject) => {
    const columns = [
      { name: 'make', type: 'VARCHAR(100)' },
      { name: 'model', type: 'VARCHAR(100)' },
      { name: 'year', type: 'INT' },
      { name: 'mileage', type: 'INT DEFAULT 0' },
      { name: 'fuel_type', type: 'VARCHAR(50)' },
      { name: 'transmission', type: 'VARCHAR(50)' },
      { name: 'body_type', type: 'VARCHAR(50)' },
      { name: 'color', type: 'VARCHAR(50)' },
      { name: 'vin', type: 'VARCHAR(17)' },
      { name: 'features', type: 'TEXT' },
      { name: 'condition_status', type: "VARCHAR(20) DEFAULT 'new'" }
    ];

    let completed = 0;
    columns.forEach(col => {
      const sql = `ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`;
      db.query(sql, (err) => {
        if (err && !err.message.includes('Duplicate column')) {
          console.log(`⚠️  Column ${col.name} might already exist or error: ${err.message}`);
        } else if (!err) {
          console.log(`✅ Added column: ${col.name}`);
        }
        completed++;
        if (completed === columns.length) {
          resolve();
        }
      });
    });
  });
};

// Step 2: Clear old supermarket data
const clearOldData = `DELETE FROM products`;

// Run migration
checkAndAddColumns().then(() => {
  console.log('\n✅ All car-specific columns processed');
  
  db.query(clearOldData, (err, result) => {
    if (err) {
      console.error('❌ Error clearing old data:', err.message);
      process.exit(1);
    }
    console.log(`✅ Cleared ${result.affectedRows} old supermarket products`);
    console.log('\n✨ Migration complete! Database is ready for car dealership.\n');
    process.exit(0);
  });
}).catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
