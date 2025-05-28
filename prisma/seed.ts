import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Seed picklist data
  const picklistData = [
    // Product Status
    { type: 'PRODUCT_STATUS', table: 'product', field: 'status', label: 'Active', value: 'active', ordering: 1 },
    { type: 'PRODUCT_STATUS', table: 'product', field: 'status', label: 'Inactive', value: 'inactive', ordering: 2 },
    { type: 'PRODUCT_STATUS', table: 'product', field: 'status', label: 'Discontinued', value: 'discontinued', ordering: 3 },
    
    // Product Categories
    { type: 'PRODUCT_CATEGORY', table: 'product', field: 'category', label: 'Electronics', value: 'electronics', ordering: 1 },
    { type: 'PRODUCT_CATEGORY', table: 'product', field: 'category', label: 'Clothing', value: 'clothing', ordering: 2 },
    { type: 'PRODUCT_CATEGORY', table: 'product', field: 'category', label: 'Books', value: 'books', ordering: 3 },
    { type: 'PRODUCT_CATEGORY', table: 'product', field: 'category', label: 'Home & Garden', value: 'home-garden', ordering: 4 },
    
    // Warehouse Locations
    { type: 'WAREHOUSE_LOCATION', table: 'stock', field: 'warehouseLocation', label: 'Main Warehouse', value: 'main-warehouse', ordering: 1 },
    { type: 'WAREHOUSE_LOCATION', table: 'stock', field: 'warehouseLocation', label: 'Secondary Warehouse', value: 'secondary-warehouse', ordering: 2 },
    { type: 'WAREHOUSE_LOCATION', table: 'stock', field: 'warehouseLocation', label: 'Retail Store A', value: 'retail-store-a', ordering: 3 },
    { type: 'WAREHOUSE_LOCATION', table: 'stock', field: 'warehouseLocation', label: 'Retail Store B', value: 'retail-store-b', ordering: 4 },
    
    // Quality Grades
    { type: 'QUALITY_GRADE', table: 'stock', field: 'qualityGrade', label: 'Grade A', value: 'grade-a', ordering: 1 },
    { type: 'QUALITY_GRADE', table: 'stock', field: 'qualityGrade', label: 'Grade B', value: 'grade-b', ordering: 2 },
    { type: 'QUALITY_GRADE', table: 'stock', field: 'qualityGrade', label: 'Grade C', value: 'grade-c', ordering: 3 },
  ];

  for (const item of picklistData) {
    await prisma.picklist.upsert({
      where: {
        type_value: {
          type: item.type,
          value: item.value,
        },
      },
      update: {},
      create: item,
    });
  }

  console.log('✅ Picklist data seeded successfully');

  // Seed sample products
  const sampleProducts = [
    {
      name: 'MacBook Pro 16"',
      description: 'Apple MacBook Pro with M2 chip',
      category: 'electronics',
      price: 2499.99,
      status: 'active',
      dynamicFields: {
        brand: 'Apple',
        model: 'MacBook Pro 16"',
        color: 'Space Gray',
        warranty: '1 year',
      },
    },
    {
      name: 'Cotton T-Shirt',
      description: 'Premium cotton t-shirt',
      category: 'clothing',
      price: 29.99,
      status: 'active',
      dynamicFields: {
        brand: 'Generic',
        material: 'Cotton',
        size: 'M',
        color: 'Blue',
      },
    },
    {
      name: 'JavaScript: The Good Parts',
      description: 'Classic JavaScript programming book',
      category: 'books',
      price: 34.99,
      status: 'active',
      dynamicFields: {
        brand: "O'Reilly",
        notes: 'Essential reading for JavaScript developers',
      },
    },
  ];

  for (const productData of sampleProducts) {
    const product = await prisma.product.upsert({
      where: { name: productData.name },
      update: {},
      create: productData,
    });

    // Add sample stock for each product
    await prisma.stock.upsert({
      where: {
        productId_batchNumber: {
          productId: product.id,
          batchNumber: 'BATCH-001',
        },
      },
      update: {},
      create: {
        productId: product.id,
        batchNumber: 'BATCH-001',
        warehouseLocation: 'main-warehouse',
        quantity: 100,
        availableQuantity: 85,
        soldQuantity: 15,
        dynamicFields: {
          supplier: 'Main Supplier',
          purchasePrice: productData.price * 0.7,
          qualityGrade: 'grade-a',
        },
      },
    });
  }

  console.log('✅ Sample products and stock seeded successfully');

  // Update product stock totals
  const products = await prisma.product.findMany({
    include: { stocks: true },
  });

  for (const product of products) {
    const totals = product.stocks.reduce(
      (acc, stock) => ({
        totalQuantity: acc.totalQuantity + stock.quantity,
        totalAvailable: acc.totalAvailable + stock.availableQuantity,
        totalSold: acc.totalSold + stock.soldQuantity,
      }),
      { totalQuantity: 0, totalAvailable: 0, totalSold: 0 }
    );

    await prisma.product.update({
      where: { id: product.id },
      data: {
        totalStockQuantity: totals.totalQuantity,
        totalStockAvailable: totals.totalAvailable,
        totalStockSold: totals.totalSold,
      },
    });
  }

  console.log('✅ Product stock totals updated successfully');
  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 