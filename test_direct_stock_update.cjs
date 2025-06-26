const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDirectStockUpdate() {
  try {
    console.log('🧪 Testing direct stock update via Prisma...\n');
    
    // Test data - using VALID orderlinenumber
    const stockId = 259;
    const orderlineId = "ordline3-0000000042";  // Using valid orderlinenumber
    const currentTime = Date.now();
    
    console.log(`📋 Updating stock ID ${stockId} with:`);
    console.log(`   Order Line: ${orderlineId}`);
    console.log(`   Status: Sold`);
    console.log(`   Timestamp: ${currentTime}`);
    console.log(`   BigInt Timestamp: ${BigInt(currentTime)}\n`);
    
    // Get initial state
    console.log('📊 Getting initial state...');
    const initialStock = await prisma.stock.findUnique({
      where: { id: stockId }
    });
    
    if (!initialStock) {
      console.error(`❌ Stock with ID ${stockId} not found`);
      return;
    }
    
    console.log('Initial Stock State:');
    console.log(`   ID: ${initialStock.id}`);
    console.log(`   PUC: ${initialStock.puc}`);
    console.log(`   RFID: ${initialStock.rfid}`);
    console.log(`   Status: ${initialStock.stockstatus}`);
    console.log(`   Order Line: ${initialStock.orderlinenumber || 'NULL'}`);
    console.log(`   RFID Scanned Time: ${initialStock.rfidscannedtime || 'NULL'}`);
    console.log(`   Sold Date: ${initialStock.solddate || 'NULL'}\n`);
    
    // Perform the update
    console.log('🔄 Performing direct Prisma update...');
    const updatedStock = await prisma.stock.update({
      where: { id: stockId },
      data: {
        stockstatus: 'Sold',
        orderlinenumber: orderlineId,
        rfidscannedtime: BigInt(currentTime),
        solddate: BigInt(currentTime),
        modifieddate: BigInt(currentTime)
      }
    });
    
    console.log('✅ Update successful!');
    console.log('Updated Stock State:');
    console.log(`   ID: ${updatedStock.id}`);
    console.log(`   Status: ${updatedStock.stockstatus}`);
    console.log(`   Order Line: ${updatedStock.orderlinenumber}`);
    console.log(`   RFID Scanned Time: ${updatedStock.rfidscannedtime}`);
    console.log(`   Sold Date: ${updatedStock.solddate}\n`);
    
    // Verify the changes
    console.log('🔍 Verification:');
    console.log(`   ✓ Status changed: ${initialStock.stockstatus} → ${updatedStock.stockstatus}`);
    console.log(`   ✓ Order Line assigned: ${updatedStock.orderlinenumber}`);
    console.log(`   ✓ RFID Scanned Time set: ${updatedStock.rfidscannedtime ? 'YES' : 'NO'}`);
    console.log(`   ✓ Sold Date set: ${updatedStock.solddate ? 'YES' : 'NO'}`);
    
    console.log('\n🎉 Direct Prisma update test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during direct stock update:', error.message);
    console.error('Error details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDirectStockUpdate(); 