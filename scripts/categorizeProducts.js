require('dotenv').config();
const db = require('../db');

console.log('Categorizing products...\n');

// Define category mappings based on product names
// Note: Beverages should be checked FIRST to catch juices before fruit keywords
const categories = {
  'Beverages': ['juice', 'water', 'soda', 'coffee', 'tea', 'cola', 'drink', 'beverage', 'beer', 'wine', 'coke', 'pepsi', 'sprite', 'lemonade', 'smoothie'],
  'Fruits & Vegetables': ['apple', 'banana', 'orange', 'tomato', 'lettuce', 'carrot', 'broccoli', 'spinach', 'potato', 'onion', 'grape', 'strawberry', 'watermelon', 'cucumber', 'pepper', 'cabbage', 'avocado', 'mango', 'pineapple', 'lemon', 'lime', 'fruit', 'vegetable', 'veggie', 'produce'],
  'Dairy & Eggs': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'dairy', 'cheddar', 'mozzarella', 'parmesan'],
  'Meat': ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'steak', 'meat', 'fish', 'salmon', 'tuna'],
  'Bakery': ['bread', 'bagel', 'croissant', 'muffin', 'cake', 'cookie', 'donut', 'pastry', 'bun', 'roll', 'bakery', 'baked']
};

// Get all products
db.query('SELECT id, productName, category FROM products', (err, products) => {
  if (err) {
    console.error('Error fetching products:', err);
    process.exit(1);
  }

  console.log(`Found ${products.length} products\n`);
  
  let updated = 0;
  let completed = 0;

  products.forEach(product => {
    // Skip if already has a category
    if (product.category && product.category.trim() !== '') {
      console.log(`✓ ${product.productName} - already categorized as "${product.category}"`);
      completed++;
      if (completed === products.length) finish();
      return;
    }

    // Try to match product name to a category
    const name = product.productName.toLowerCase();
    let matchedCategory = null;

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        matchedCategory = category;
        break;
      }
    }

    if (matchedCategory) {
      db.query('UPDATE products SET category = ? WHERE id = ?', [matchedCategory, product.id], (updateErr) => {
        if (updateErr) {
          console.error(`✗ ${product.productName} - error updating:`, updateErr.message);
        } else {
          console.log(`✓ ${product.productName} → "${matchedCategory}"`);
          updated++;
        }
        completed++;
        if (completed === products.length) finish();
      });
    } else {
      console.log(`- ${product.productName} - no category match (keeping null)`);
      completed++;
      if (completed === products.length) finish();
    }
  });

  function finish() {
    console.log(`\n--- Summary ---`);
    console.log(`Total products: ${products.length}`);
    console.log(`Categorized: ${updated}`);
    console.log('\nDone! Your filter dropdown will now show these categories.');
    process.exit(0);
  }

  // Handle case when no products exist
  if (products.length === 0) {
    console.log('No products found in database.');
    process.exit(0);
  }
});
