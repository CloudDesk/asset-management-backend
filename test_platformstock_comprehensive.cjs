const { PrismaClient } = require('@prisma/client');
const { PlatformStockService } = require('./build/services/platformStock.service.js');
const { logger } = require('./build/config/logger.js');

const prisma = new PrismaClient();
const platformStockService = new PlatformStockService();

async function testPlatformStockOperations() {
  console.log('🚀 Starting comprehensive PlatformStock test...\n');

  try {
    // Test 1: Use an existing product
    console.log('📦 Using existing product...');
    const existingProduct = await prisma.$queryRaw`SELECT id, name, puc FROM product LIMIT 1`;
    const testProduct = existingProduct[0];
    console.log(`✅ Using existing product with ID: ${testProduct.id} (${testProduct.name})\n`);

    const productId = Number(testProduct.id);
    const platform = 'amazon';

    // Test 2: Test create operation (new PlatformStock record)
    console.log('🆕 Testing PlatformStock create operation...');
    const createData = {
      productid: productId,
      platform: platform,
      availableqty: 1,
      soldqty: 0,
      totalqty: 1,
      orderedqty: 0,
      lockqty: 0,
      createddate: Date.now(),
      modifieddate: Date.now(),
    };

    console.log('📤 Create data:', createData);
    const createdPlatformStock = await platformStockService.create(createData);
    console.log('✅ PlatformStock created:', {
      id: createdPlatformStock.id,
      productid: createdPlatformStock.productid,
      platform: createdPlatformStock.platform,
      availableqty: createdPlatformStock.availableqty,
      totalqty: createdPlatformStock.totalqty
    });
    console.log('');

    // Test 3: Test update operation (existing PlatformStock record)
    console.log('🔄 Testing PlatformStock update operation...');
    const updateData = {
      availableqty: 5,
      totalqty: 5,
      modifieddate: Date.now(),
    };

    console.log('📤 Update data:', updateData);
    const updatedPlatformStock = await platformStockService.update(createdPlatformStock.id, updateData);
    console.log('✅ PlatformStock updated:', {
      id: updatedPlatformStock.id,
      productid: updatedPlatformStock.productid,
      platform: updatedPlatformStock.platform,
      availableqty: updatedPlatformStock.availableqty,
      totalqty: updatedPlatformStock.totalqty
    });
    console.log('');

    // Test 4: Test upsert operation (should update existing)
    console.log('🔄 Testing PlatformStock upsert operation (update existing)...');
    const upsertData = {
      productid: productId,
      platform: platform,
      availableqty: 10,
      totalqty: 10,
      modifieddate: Date.now(),
    };

    console.log('📤 Upsert data:', upsertData);
    const upsertedPlatformStock = await platformStockService.upsert(upsertData);
    console.log('✅ PlatformStock upserted (updated):', {
      id: upsertedPlatformStock.id,
      productid: upsertedPlatformStock.productid,
      platform: upsertedPlatformStock.platform,
      availableqty: upsertedPlatformStock.availableqty,
      totalqty: upsertedPlatformStock.totalqty
    });
    console.log('');

    // Test 5: Test upsert operation (create new for different platform)
    console.log('🆕 Testing PlatformStock upsert operation (create new)...');
    const newPlatform = 'flipkart';
    const upsertNewData = {
      productid: productId,
      platform: newPlatform,
      availableqty: 3,
      totalqty: 3,
      modifieddate: Date.now(),
    };

    console.log('📤 Upsert new platform data:', upsertNewData);
    const newUpsertedPlatformStock = await platformStockService.upsert(upsertNewData);
    console.log('✅ PlatformStock upserted (created new):', {
      id: newUpsertedPlatformStock.id,
      productid: newUpsertedPlatformStock.productid,
      platform: newUpsertedPlatformStock.platform,
      availableqty: newUpsertedPlatformStock.availableqty,
      totalqty: newUpsertedPlatformStock.totalqty
    });
    console.log('');

    // Test 6: Test updatePlatformStockQuantities method
    console.log('📊 Testing updatePlatformStockQuantities method...');
    const stockInfo = {
      ecompublish: true,
      stockstatus: 'available',
      quantity: 1,
      isNewStock: true,
      operation: 'create'
    };

    console.log('📤 Stock info for quantity update:', stockInfo);
    const quantityUpdatedStock = await platformStockService.updatePlatformStockQuantities(
      productId,
      platform,
      stockInfo
    );
    console.log('✅ PlatformStock quantities updated:', {
      id: quantityUpdatedStock.id,
      productid: quantityUpdatedStock.productid,
      platform: quantityUpdatedStock.platform,
      availableqty: quantityUpdatedStock.availableqty,
      totalqty: quantityUpdatedStock.totalqty
    });
    console.log('');

    // Test 7: Test transferStockBetweenPlatforms method
    console.log('🔄 Testing transferStockBetweenPlatforms method...');
    const transferStockInfo = {
      ecompublish: true,
      stockstatus: 'available',
      quantity: 1
    };

    console.log('📤 Transfer info:', transferStockInfo);
    const transferResult = await platformStockService.transferStockBetweenPlatforms(
      productId,
      platform, // from amazon
      newPlatform, // to flipkart
      transferStockInfo
    );
    console.log('✅ Stock transferred:', {
      fromPlatform: {
        id: transferResult.fromPlatformStock.id,
        platform: platform,
        availableqty: transferResult.fromPlatformStock.availableqty,
        totalqty: transferResult.fromPlatformStock.totalqty
      },
      toPlatform: {
        id: transferResult.toPlatformStock.id,
        platform: newPlatform,
        availableqty: transferResult.toPlatformStock.availableqty,
        totalqty: transferResult.toPlatformStock.totalqty
      }
    });
    console.log('');

    // Test 8: Test getByProductAndPlatform method
    console.log('🔍 Testing getByProductAndPlatform method...');
    const retrievedStock = await platformStockService.getByProductAndPlatform(productId, platform);
    console.log('✅ Retrieved PlatformStock:', {
      id: retrievedStock.id,
      productid: retrievedStock.productid,
      platform: retrievedStock.platform,
      availableqty: retrievedStock.availableqty,
      totalqty: retrievedStock.totalqty
    });
    console.log('');

    // Test 9: Test findById method
    console.log('🔍 Testing findById method...');
    const foundById = await platformStockService.findById(createdPlatformStock.id);
    console.log('✅ Found by ID:', {
      id: foundById.id,
      productid: foundById.productid,
      platform: foundById.platform,
      availableqty: foundById.availableqty,
      totalqty: foundById.totalqty
    });
    console.log('');

    // Test 10: Test findMany with filters
    console.log('🔍 Testing findMany with filters...');
    const filters = {
      productid: productId,
      platform: platform
    };
    const paginationResult = await platformStockService.findMany(filters, 1, 10);
    console.log('✅ Found with filters:', {
      total: paginationResult.total,
      count: paginationResult.data.length,
      firstRecord: paginationResult.data[0] ? {
        id: paginationResult.data[0].id,
        productid: paginationResult.data[0].productid,
        platform: paginationResult.data[0].platform,
        availableqty: paginationResult.data[0].availableqty,
        totalqty: paginationResult.data[0].totalqty
      } : null
    });
    console.log('');

    console.log('🎉 All PlatformStock tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
  } finally {
    // Cleanup: Delete test PlatformStock data only
    console.log('\n🧹 Cleaning up test PlatformStock data...');
    try {
      if (typeof testProduct !== 'undefined' && testProduct.id) {
        // Delete PlatformStock records created during test
        await prisma.$queryRaw`DELETE FROM platformstock WHERE platform IN ('amazon', 'flipkart') AND productid = ${testProduct.id}`;
        console.log('✅ Test PlatformStock data cleaned up successfully');
      } else {
        console.log('⚠️ No test product found, skipping cleanup');
      }
    } catch (cleanupError) {
      console.error('⚠️ Cleanup error:', cleanupError.message);
    }

    await prisma.$disconnect();
  }
}

// Run the test
testPlatformStockOperations().catch(console.error);
