import { ProductService } from './build/services/product.service.js';

async function updateAllProductStatuses() {
  const productService = new ProductService();
  
  try {
    console.log('Starting to update all product statuses...');
    
    // Get all products
    const result = await productService.findMany({}, 1, 1000);
    const products = result.data;
    
    console.log(`Found ${products.length} products to update`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const product of products) {
      try {
        if (product.puc) {
          console.log(`Updating product ${product.id} (${product.name}) with PUC: ${product.puc}`);
          await productService.updateStockTotals(product.puc);
          updated++;
        } else {
          console.log(`Skipping product ${product.id} (no PUC)`);
          skipped++;
        }
      } catch (error) {
        console.error(`Error updating product ${product.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`\nUpdate completed:`);
    console.log(`- Updated: ${updated} products`);
    console.log(`- Skipped: ${skipped} products`);
    
  } catch (error) {
    console.error('Error updating product statuses:', error);
  }
}

updateAllProductStatuses(); 