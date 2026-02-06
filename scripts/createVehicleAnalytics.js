require('dotenv').config();
const db = require('../db');

// Create vehicle_views table to track who views vehicles
const createViewsTable = `
CREATE TABLE IF NOT EXISTS vehicle_views (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_id INT NOT NULL,
    seller_id INT NOT NULL,
    viewer_id INT,
    visitor_ip VARCHAR(45),
    visitor_user_agent TEXT,
    referrer VARCHAR(255),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INT DEFAULT 0,
    FOREIGN KEY (vehicle_id) REFERENCES products(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (viewer_id) REFERENCES users(id),
    INDEX idx_vehicle_seller (vehicle_id, seller_id),
    INDEX idx_viewed_at (viewed_at),
    INDEX idx_viewer (viewer_id)
)
`;

db.query(createViewsTable, (err) => {
    if (err) {
        console.error('Error creating vehicle_views table:', err);
        process.exit(1);
    }
    console.log('✓ vehicle_views table created successfully');
    
    // Create daily_view_stats for performance (materialized view data)
    const createStatsTable = `
    CREATE TABLE IF NOT EXISTS daily_view_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        vehicle_id INT NOT NULL,
        seller_id INT NOT NULL,
        view_date DATE NOT NULL,
        total_views INT DEFAULT 0,
        unique_viewers INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES products(id),
        FOREIGN KEY (seller_id) REFERENCES users(id),
        UNIQUE KEY unique_vehicle_date (vehicle_id, view_date),
        INDEX idx_seller_date (seller_id, view_date)
    )
    `;
    
    db.query(createStatsTable, (statsErr) => {
        if (statsErr) {
            console.error('Error creating daily_view_stats table:', statsErr);
            process.exit(1);
        }
        console.log('✓ daily_view_stats table created successfully');
        console.log('\n✅ Vehicle analytics migration completed!');
        process.exit(0);
    });
});
