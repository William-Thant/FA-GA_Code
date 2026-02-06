const db = require('../db');

const AnalyticsController = {
    // Get seller vehicle analytics with filters
    getVehicleAnalytics(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const { startDate, endDate, minMileage, maxMileage, fuelType } = req.query;
        
        // Build query for vehicle views with filters
        let sql = `
            SELECT 
                p.id,
                p.productName,
                p.image,
                p.mileage,
                p.fuel_type,
                p.price,
                COUNT(DISTINCT vv.id) as total_views,
                COUNT(DISTINCT vv.viewer_id) as unique_visitors,
                COUNT(DISTINCT DATE(vv.viewed_at)) as days_viewed,
                MAX(vv.viewed_at) as last_view,
                AVG(vv.duration_seconds) as avg_view_duration
            FROM products p
            LEFT JOIN vehicle_views vv ON p.id = vv.vehicle_id
            WHERE p.seller_id = ?
        `;
        
        const params = [userId];
        
        // Add date filter
        if (startDate) {
            sql += ` AND DATE(vv.viewed_at) >= ?`;
            params.push(startDate);
        }
        
        if (endDate) {
            sql += ` AND DATE(vv.viewed_at) <= ?`;
            params.push(endDate);
        }
        
        // Add mileage filter
        if (minMileage) {
            sql += ` AND p.mileage >= ?`;
            params.push(parseInt(minMileage));
        }
        
        if (maxMileage) {
            sql += ` AND p.mileage <= ?`;
            params.push(parseInt(maxMileage));
        }
        
        // Add fuel type filter
        if (fuelType && fuelType !== 'all') {
            sql += ` AND p.fuel_type = ?`;
            params.push(fuelType);
        }
        
        sql += ` GROUP BY p.id ORDER BY total_views DESC`;
        
        db.query(sql, params, (err, vehicles) => {
            if (err) {
                console.error('Error fetching vehicle analytics:', err);
                return res.json({ error: 'Error loading analytics' });
            }
            
            // Get visitor details for each vehicle
            const vehicleAnalytics = vehicles.map(v => ({
                ...v,
                total_views: v.total_views || 0,
                unique_visitors: v.unique_visitors || 0
            }));
            
            res.json({ vehicles: vehicleAnalytics });
        });
    },

    // Get detailed viewer information for a specific vehicle
    getVehicleViewers(req, res) {
        const vehicleId = req.params.vehicleId;
        const userId = req.session.user.userId || req.session.user.id;
        const { startDate, endDate } = req.query;
        
        // Verify ownership
        db.query('SELECT seller_id FROM products WHERE id = ?', [vehicleId], (err, results) => {
            if (err || !results[0] || results[0].seller_id !== userId) {
                return res.json({ error: 'Vehicle not found or access denied' });
            }
            
            let sql = `
                SELECT 
                    vv.id,
                    vv.viewer_id,
                    u.username as viewer_name,
                    u.email as viewer_email,
                    vv.visitor_ip,
                    vv.viewed_at,
                    vv.duration_seconds
                FROM vehicle_views vv
                LEFT JOIN users u ON vv.viewer_id = u.id
                WHERE vv.vehicle_id = ?
            `;
            
            const params = [vehicleId];
            
            if (startDate) {
                sql += ` AND DATE(vv.viewed_at) >= ?`;
                params.push(startDate);
            }
            
            if (endDate) {
                sql += ` AND DATE(vv.viewed_at) <= ?`;
                params.push(endDate);
            }
            
            sql += ` ORDER BY vv.viewed_at DESC LIMIT 100`;
            
            db.query(sql, params, (viewerErr, viewers) => {
                if (viewerErr) {
                    console.error('Error fetching viewers:', viewerErr);
                    return res.json({ error: 'Error loading viewers' });
                }
                
                res.json({ viewers: viewers || [] });
            });
        });
    },

    // Get viewer statistics summary
    getAnalyticsSummary(req, res) {
        const userId = req.session.user.userId || req.session.user.id;
        const { startDate, endDate } = req.query;
        
        let sql = `
            SELECT 
                COUNT(DISTINCT vv.id) as total_views,
                COUNT(DISTINCT vv.viewer_id) as unique_visitors,
                COUNT(DISTINCT vv.vehicle_id) as vehicles_viewed,
                AVG(vv.duration_seconds) as avg_duration,
                MAX(vv.viewed_at) as last_view_time
            FROM vehicle_views vv
            JOIN products p ON vv.vehicle_id = p.id
            WHERE p.seller_id = ?
        `;
        
        const params = [userId];
        
        if (startDate) {
            sql += ` AND DATE(vv.viewed_at) >= ?`;
            params.push(startDate);
        }
        
        if (endDate) {
            sql += ` AND DATE(vv.viewed_at) <= ?`;
            params.push(endDate);
        }
        
        db.query(sql, params, (err, results) => {
            if (err) {
                console.error('Error fetching summary:', err);
                return res.json({ error: 'Error loading summary' });
            }
            
            const summary = results[0] || {
                total_views: 0,
                unique_visitors: 0,
                vehicles_viewed: 0,
                avg_duration: 0,
                last_view_time: null
            };
            
            res.json(summary);
        });
    }
};

module.exports = AnalyticsController;
