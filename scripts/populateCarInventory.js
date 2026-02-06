const db = require('../db');

console.log('🚗 Populating car dealership inventory...\n');

const sampleCars = [
  {
    productName: '2024 Tesla Model 3',
    make: 'Tesla',
    model: 'Model 3',
    year: 2024,
    price: 4999,
    quantity: 1,
    category: 'Electric',
    mileage: 120,
    fuel_type: 'Electric',
    transmission: 'Automatic',
    body_type: 'Sedan',
    color: 'Pearl White',
    vin: '5YJ3E1EA5PF123456',
    features: 'Autopilot, Premium Interior, 18" Wheels, Dual Motor AWD, Glass Roof',
    condition_status: 'new',
    description: 'Brand new Tesla Model 3 with cutting-edge electric performance and autopilot technology. Zero emissions, incredible acceleration.',
    imageUrl: '/images/tesla-model3.jpg'
  },
  {
    productName: '2023 BMW M3',
    make: 'BMW',
    model: 'M3',
    year: 2023,
    price: 4899,
    quantity: 1,
    category: 'Luxury',
    mileage: 5200,
    fuel_type: 'Gasoline',
    transmission: 'Automatic',
    body_type: 'Sedan',
    color: 'Alpine White',
    vin: 'WBS8M9C51N5K12345',
    features: 'M Sport Package, Carbon Fiber Trim, Harman Kardon Sound, Heads-Up Display, Adaptive M Suspension',
    condition_status: 'used',
    description: 'Lightly used BMW M3 with exceptional performance. Twin-turbo inline-6 engine producing 503 HP. Perfect condition.',
    imageUrl: '/images/bmw-m3.jpg'
  },
  {
    productName: '2024 Ford F-150 Lightning',
    make: 'Ford',
    model: 'F-150 Lightning',
    year: 2024,
    price: 4799,
    quantity: 1,
    category: 'Truck',
    mileage: 0,
    fuel_type: 'Electric',
    transmission: 'Automatic',
    body_type: 'Pickup Truck',
    color: 'Antimatter Blue',
    vin: '1FTFW1E84P1234567',
    features: 'Extended Range Battery, Pro Power Onboard, BlueCruise, 360° Camera, LED Lighting',
    condition_status: 'new',
    description: 'Revolutionary electric pickup truck with 320 miles of range. Powerful, capable, and zero emissions.',
    imageUrl: '/images/ford-f150-lightning.jpg'
  },
  {
    productName: '2023 Mercedes-Benz GLE 450',
    make: 'Mercedes-Benz',
    model: 'GLE 450',
    year: 2023,
    price: 4699,
    quantity: 1,
    category: 'SUV',
    mileage: 8900,
    fuel_type: 'Gasoline',
    transmission: 'Automatic',
    body_type: 'SUV',
    color: 'Obsidian Black',
    vin: '4JGDF7CE1PA123456',
    features: 'AMG Line, Panoramic Sunroof, Burmester Sound, MBUX Infotainment, 360° Camera, Adaptive Cruise Control',
    condition_status: 'used',
    description: 'Luxury SUV with impeccable German engineering. Spacious interior, advanced technology, and smooth ride.',
    imageUrl: '/images/mercedes-gle450.jpg'
  },
  {
    productName: '2024 Toyota Camry Hybrid',
    make: 'Toyota',
    model: 'Camry',
    year: 2024,
    price: 3999,
    quantity: 1,
    category: 'Sedan',
    mileage: 0,
    fuel_type: 'Hybrid',
    transmission: 'CVT',
    body_type: 'Sedan',
    color: 'Celestial Silver',
    vin: '4T1K61AK5PU123456',
    features: 'Toyota Safety Sense 3.0, Apple CarPlay, Android Auto, Wireless Charging, LED Headlights',
    condition_status: 'new',
    description: 'Fuel-efficient hybrid sedan with legendary Toyota reliability. Perfect for daily commuting with excellent MPG.',
    imageUrl: '/images/toyota-camry.jpg'
  },
  {
    productName: '2023 Porsche 911 Carrera',
    make: 'Porsche',
    model: '911 Carrera',
    year: 2023,
    price: 4999,
    quantity: 1,
    category: 'Sports',
    mileage: 3400,
    fuel_type: 'Gasoline',
    transmission: 'PDK',
    body_type: 'Coupe',
    color: 'Guards Red',
    vin: 'WP0AA2A91PS123456',
    features: 'Sport Chrono Package, PASM, Bose Sound, Sport Exhaust, 20" Wheels, Alcantara Interior',
    condition_status: 'used',
    description: 'Iconic sports car with timeless design. Twin-turbo flat-6 engine delivering exhilarating performance.',
    imageUrl: '/images/porsche-911.jpg'
  },
  {
    productName: '2024 Honda CR-V Hybrid',
    make: 'Honda',
    model: 'CR-V',
    year: 2024,
    price: 4599,
    quantity: 1,
    category: 'SUV',
    mileage: 0,
    fuel_type: 'Hybrid',
    transmission: 'CVT',
    body_type: 'SUV',
    color: 'Sonic Gray Pearl',
    vin: '7FARS6H51PE123456',
    features: 'Honda Sensing, Panoramic Sunroof, Hands-Free Liftgate, Wireless Apple CarPlay, Premium Audio',
    condition_status: 'new',
    description: 'Spacious and efficient hybrid SUV perfect for families. Combines practicality with fuel economy.',
    imageUrl: '/images/honda-crv.jpg'
  },
  {
    productName: '2023 Audi e-tron GT',
    make: 'Audi',
    model: 'e-tron GT',
    year: 2023,
    price: 4799,
    quantity: 1,
    category: 'Electric',
    mileage: 4100,
    fuel_type: 'Electric',
    transmission: 'Automatic',
    body_type: 'Sedan',
    vin: 'WAUZZZ4V4PA123456',
    color: 'Daytona Gray',
    features: 'Virtual Cockpit, Matrix LED, Bang & Olufsen Sound, Air Suspension, 22" Wheels, Carbon Accents',
    condition_status: 'used',
    description: 'Stunning electric performance sedan with Quattro AWD. Combines luxury, technology, and zero emissions.',
    imageUrl: '/images/audi-etron-gt.jpg'
  },
  {
    productName: '2024 Chevrolet Silverado 1500',
    make: 'Chevrolet',
    model: 'Silverado 1500',
    year: 2024,
    price: 4499,
    quantity: 1,
    category: 'Truck',
    mileage: 0,
    fuel_type: 'Gasoline',
    transmission: 'Automatic',
    body_type: 'Pickup Truck',
    color: 'Summit White',
    vin: '3GCUYBEL3PG123456',
    features: 'Z71 Off-Road Package, Crew Cab, 6.2L V8, Bed Liner, Tow Package, Leather Interior',
    condition_status: 'new',
    description: 'Rugged and capable full-size pickup truck. Powerful V8 engine with impressive towing capacity.',
    imageUrl: '/images/chevy-silverado.jpg'
  },
  {
    productName: '2023 Mazda MX-5 Miata',
    make: 'Mazda',
    model: 'MX-5 Miata',
    year: 2023,
    price: 3799,
    quantity: 1,
    category: 'Sports',
    mileage: 6700,
    fuel_type: 'Gasoline',
    transmission: 'Manual',
    body_type: 'Convertible',
    color: 'Soul Red Crystal',
    vin: 'JM1NDAB71P0123456',
    features: 'Soft Top Convertible, Bose Audio, Recaro Seats, Brembo Brakes, BBS Wheels',
    condition_status: 'used',
    description: 'Pure driving joy in a lightweight roadster. Perfect balance and handling for enthusiasts.',
    imageUrl: '/images/mazda-miata.jpg'
  },
  {
    productName: '2024 Lexus RX 350h',
    make: 'Lexus',
    model: 'RX 350h',
    year: 2024,
    price: 4699,
    quantity: 1,
    category: 'Luxury',
    mileage: 0,
    fuel_type: 'Hybrid',
    transmission: 'CVT',
    body_type: 'SUV',
    color: 'Caviar',
    vin: '2T2HZMDA4PC123456',
    features: 'Mark Levinson Audio, Panoramic View Monitor, Heated/Cooled Seats, Head-Up Display, Safety System+ 3.0',
    condition_status: 'new',
    description: 'Premium hybrid SUV with legendary Lexus reliability and comfort. Refined luxury meets efficiency.',
    imageUrl: '/images/lexus-rx350h.jpg'
  },
  {
    productName: '2023 Jeep Wrangler Rubicon',
    make: 'Jeep',
    model: 'Wrangler Rubicon',
    year: 2023,
    price: 4599,
    quantity: 1,
    category: 'SUV',
    mileage: 12000,
    fuel_type: 'Gasoline',
    transmission: 'Automatic',
    body_type: 'SUV',
    color: 'Hellayella',
    vin: '1C4HJXEN0PW123456',
    features: '4WD, Rock-Trac 4x4, Locking Differentials, Fox Shocks, Removable Top, Winch Ready',
    condition_status: 'used',
    description: 'Ultimate off-road capable SUV. Go anywhere with legendary Jeep capability and style.',
    imageUrl: '/images/jeep-wrangler.jpg'
  }
];

const insertQuery = `
  INSERT INTO products (productName, make, model, year, price, quantity, category, mileage, 
    fuel_type, transmission, body_type, color, vin, features, condition_status, image)
  VALUES ?
`;

const values = sampleCars.map(car => {
  // Extract just the filename from imageUrl (remove /images/ prefix)
  const imageFilename = car.imageUrl.replace('/images/', '');
  
  return [
    car.productName, car.make, car.model, car.year, car.price, car.quantity, car.category,
    car.mileage, car.fuel_type, car.transmission, car.body_type, car.color, car.vin,
    car.features, car.condition_status, imageFilename
  ];
});

db.query(insertQuery, [values], (err, result) => {
  if (err) {
    console.error('❌ Error inserting sample cars:', err.message);
    process.exit(1);
  }
  console.log(`✅ Successfully added ${result.affectedRows} cars to inventory`);
  console.log('\n🎉 Car dealership inventory is ready!\n');
  process.exit(0);
});
