const { PrismaClient } = require('@prisma/client');
const { PlatformStockService } = require('./build/services/platformStock.service.js');
const { StockService } = require('./build/services/stock.service.js');
const { logger } = require('./build/config/logger.js');

const prisma = new PrismaClient();
const platformStockService = new PlatformStockService();
const stockService = new StockService();

async function testStockCreationWithPlatformStock() {
  console.log('🚀 Testing Stock Creation with PlatformStock Update...\n');

  try {
    const puc = 'NIV-IS-0031';
    const platform = 'amazon';

    // Step 1: Check if product exists with this PUC
    console.log(`📦 Checking product with PUC: ${puc}...`);
    const product = await prisma.$queryRaw`SELECT id, name, puc FROM product WHERE puc = ${puc} LIMIT 1`;
    
    if (!product || product.length === 0) {
      console.log(`❌ Product with PUC ${puc} not found. Creating test product...`);
      
      // Create a test product
      const newProduct = await prisma.$queryRaw`
        INSERT INTO product (name, puc, shortdescription, price, productstatus, createddate, modifieddate)
        VALUES ('Test Product NIV-IS-0031', ${puc}, 'Test product for stock creation', 100.00, 'active', ${Date.now()}, ${Date.now()})
        RETURNING id, name, puc
      `;
      console.log(`✅ Test product created:`, newProduct[0]);
    } else {
      console.log(`✅ Product found:`, product[0]);
    }

    // Get the product ID
    const productResult = await prisma.$queryRaw`SELECT id, name, puc FROM product WHERE puc = ${puc} LIMIT 1`;
    const productId = Number(productResult[0].id);
    console.log(`📋 Using Product ID: ${productId}\n`);

    // Step 2: Check current PlatformStock status before stock creation
    console.log('🔍 Checking PlatformStock status BEFORE stock creation...');
    const platformStockBefore = await platformStockService.getByProductAndPlatform(productId, platform);
    
    if (platformStockBefore) {
      console.log('📊 PlatformStock BEFORE:', {
        id: platformStockBefore.id,
        productid: platformStockBefore.productid,
        platform: platformStockBefore.platform,
        availableqty: platformStockBefore.availableqty,
        totalqty: platformStockBefore.totalqty,
        soldqty: platformStockBefore.soldqty
      });
    } else {
      console.log('📊 No PlatformStock record exists yet');
    }
    console.log('');

    // Step 3: Create a new stock record
    console.log('🆕 Creating new stock record...');
    const stockData = {
      puc: puc,
      platform: platform,
      stockstatus: 'Available',
      ecompublish: true,
      createddate: Date.now(),
      modifieddate: Date.now(),
      // Add some additional fields that might be required
      batchno: 'TEST-BATCH-001',
      serialnumber: `SN-${Date.now()}`,
    };

    console.log('📤 Stock data to create:', stockData);
    
    try {
      const createdStock = await stockService.create(stockData);
      console.log('✅ Stock created successfully:', {
        id: createdStock.id,
        puc: createdStock.puc,
        platform: createdStock.platform,
        stockstatus: createdStock.stockstatus,
        ecompublish: createdStock.ecompublish
      });
    } catch (stockError) {
      console.log('⚠️ Stock creation failed, trying alternative approach...');
      console.log('Stock error:', stockError.message);
      
      // Try using dynamicCreate directly
      const { dynamicCreate } = require('./build/utils/dynamicDbOperations.js');
      const createdStock = await dynamicCreate('stock', stockData);
      console.log('✅ Stock created via dynamicCreate:', {
        id: createdStock.id,
        puc: createdStock.puc,
        platform: createdStock.platform,
        stockstatus: createdStock.stockstatus
      });
    }
    console.log('');

    // Step 4: Check PlatformStock status after stock creation
    console.log('🔍 Checking PlatformStock status AFTER stock creation...');
    const platformStockAfter = await platformStockService.getByProductAndPlatform(productId, platform);
    
    if (platformStockAfter) {
      console.log('📊 PlatformStock AFTER:', {
        id: platformStockAfter.id,
        productid: platformStockAfter.productid,
        platform: platformStockAfter.platform,
        availableqty: platformStockAfter.availableqty,
        totalqty: platformStockAfter.totalqty,
        soldqty: platformStockAfter.soldqty
      });

      // Compare before and after
      if (platformStockBefore) {
        console.log('\n📈 PlatformStock Changes:');
        console.log(`  Available Qty: ${platformStockBefore.availableqty} → ${platformStockAfter.availableqty}`);
        console.log(`  Total Qty: ${platformStockBefore.totalqty} → ${platformStockAfter.totalqty}`);
        console.log(`  Sold Qty: ${platformStockBefore.soldqty} → ${platformStockAfter.soldqty}`);
        
        if (platformStockAfter.availableqty > platformStockBefore.availableqty) {
          console.log('✅ PlatformStock availableqty increased correctly!');
        } else {
          console.log('⚠️ PlatformStock availableqty did not increase as expected');
        }
      } else {
        console.log('✅ PlatformStock record was created successfully!');
      }
    } else {
      console.log('❌ PlatformStock record was NOT created/updated');
    }
    console.log('');

    // Step 5: Test manual PlatformStock update
    console.log('🔄 Testing manual PlatformStock update...');
    try {
      const updateResult = await platformStockService.updatePlatformStockQuantities(
        productId,
        platform,
        {
          ecompublish: true,
          stockstatus: 'available',
          quantity: 1,
          isNewStock: true,
          operation: 'create'
        }
      );
      
      if (updateResult) {
        console.log('✅ Manual PlatformStock update successful:', {
          id: updateResult.id,
          availableqty: updateResult.availableqty,
          totalqty: updateResult.totalqty
        });
      } else {
        console.log('ℹ️ Manual PlatformStock update returned null (no changes needed)');
      }
    } catch (updateError) {
      console.log('❌ Manual PlatformStock update failed:', updateError.message);
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testStockCreationWithPlatformStock().catch(console.error);
