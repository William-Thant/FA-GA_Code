const db = require('../db');

// Add settings-related columns to users table
const addSettingsColumns = () => {
    console.log('Adding settings columns to users table...\n');

    // First, check which columns already exist
    db.query('SHOW COLUMNS FROM users', (err, columns) => {
        if (err) {
            console.error('Error checking existing columns:', err);
            db.end();
            return;
        }

        const existingColumns = columns.map(col => col.Field);
        const columnsToAdd = [];

        // Check which columns need to be added
        if (!existingColumns.includes('theme')) {
            columnsToAdd.push({
                name: 'theme',
                sql: `ALTER TABLE users ADD COLUMN theme VARCHAR(10) DEFAULT 'light'`
            });
        }

        if (!existingColumns.includes('emailNotifications')) {
            columnsToAdd.push({
                name: 'emailNotifications',
                sql: `ALTER TABLE users ADD COLUMN emailNotifications BOOLEAN DEFAULT true`
            });
        }

        if (!existingColumns.includes('promotionalEmails')) {
            columnsToAdd.push({
                name: 'promotionalEmails',
                sql: `ALTER TABLE users ADD COLUMN promotionalEmails BOOLEAN DEFAULT false`
            });
        }

        if (!existingColumns.includes('newsletter')) {
            columnsToAdd.push({
                name: 'newsletter',
                sql: `ALTER TABLE users ADD COLUMN newsletter BOOLEAN DEFAULT false`
            });
        }

        if (columnsToAdd.length === 0) {
            console.log('✓ All settings columns already exist!');
            db.end();
            return;
        }

        console.log(`Found ${columnsToAdd.length} column(s) to add...\n`);

        // Execute each query
        let completed = 0;
        columnsToAdd.forEach((column) => {
            db.query(column.sql, (err, result) => {
                if (err) {
                    console.error(`✗ Error adding column '${column.name}':`, err.message);
                } else {
                    console.log(`✓ Added column: ${column.name}`);
                }
                
                completed++;
                if (completed === columnsToAdd.length) {
                    console.log('\n✓ Settings columns migration completed!');
                    console.log('\nThe following columns are now in the users table:');
                    console.log('  - theme (VARCHAR(10), default: "light")');
                    console.log('  - emailNotifications (BOOLEAN, default: true)');
                    console.log('  - promotionalEmails (BOOLEAN, default: false)');
                    console.log('  - newsletter (BOOLEAN, default: false)');
                    
                    db.end();
                }
            });
        });
    });
};

// Run the migration
addSettingsColumns();
