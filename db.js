const mysql = require('mysql2');
require('dotenv').config(); // Load variables from .env if present

// Use a connection pool for safe concurrent access and transactions
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'c372_supermarketdb'
});

// Test a connection from the pool
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL pool:', err);
        return;
    }
    console.log('Connected to MySQL database (pool)');
    connection.release();
});

module.exports = pool;