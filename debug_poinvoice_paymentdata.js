import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugPoinvoicePaymentData() {
  console.log('=== DEBUGGING POINVOICE PAYMENTDATA ISSUE ===\n');

  try {
    // Step 1: Direct database query to verify data exists
    console.log('1. DIRECT DATABASE QUERY:');
    const directQuery = await prisma.$queryRawUnsafe(
      'SELECT id, paymentdata FROM poinvoice WHERE id IN (5, 16, 17, 18, 20) ORDER BY id'
    );
    
    console.log('Direct query results:');
    directQuery.forEach(record => {
      console.log(`  ID ${record.id}:`);
      console.log(`    paymentdata type: ${typeof record.paymentdata}`);
      console.log(`    paymentdata value: ${JSON.stringify(record.paymentdata)}`);
      console.log(`    paymentdata constructor: ${record.paymentdata?.constructor?.name}`);
      console.log('');
    });

    // Step 2: Test dynamicFindUnique function directly
    console.log('\n2. TESTING dynamicFindUnique FUNCTION:');
    
    // Import the function
    const { dynamicFindUnique } = await import('./build/utils/dynamicDbOperations.js');
    
    for (const testId of [5, 16, 17, 18, 20]) {
      console.log(`\nTesting dynamicFindUnique for ID ${testId}:`);
      const result = await dynamicFindUnique('poinvoice', { id: testId.toString() });
      
      if (result) {
        console.log(`  Found record with ID: ${result.id}`);
        console.log(`  paymentdata type: ${typeof result.paymentdata}`);
        console.log(`  paymentdata value: ${JSON.stringify(result.paymentdata)}`);
        console.log(`  paymentdata constructor: ${result.paymentdata?.constructor?.name}`);
        console.log(`  All keys: ${Object.keys(result).join(', ')}`);
      } else {
        console.log(`  No record found for ID ${testId}`);
      }
    }

    // Step 3: Test convertBigIntToNumber function
    console.log('\n3. TESTING convertBigIntToNumber FUNCTION:');
    
    const { convertBigIntToNumber } = await import('./build/utils/dynamicDbOperations.js');
    
    // Test with sample data that mimics what might come from the database
    const testData = {
      id: 5,
      paymentdata: directQuery[0]?.paymentdata // Use actual data from database
    };
    
    console.log('Before convertBigIntToNumber:');
    console.log(`  paymentdata type: ${typeof testData.paymentdata}`);
    console.log(`  paymentdata value: ${JSON.stringify(testData.paymentdata)}`);
    
    const converted = convertBigIntToNumber(testData);
    
    console.log('After convertBigIntToNumber:');
    console.log(`  paymentdata type: ${typeof converted.paymentdata}`);
    console.log(`  paymentdata value: ${JSON.stringify(converted.paymentdata)}`);

    // Step 4: Test formatPoinvoiceForAPI function
    console.log('\n4. TESTING formatPoinvoiceForAPI FUNCTION:');
    
    const { formatPoinvoiceForAPI } = await import('./build/utils/dynamicDbOperations.js');
    
    const samplePoinvoice = {
      id: 5,
      paymentdata: directQuery[0]?.paymentdata,
      invoiceamount: 1000,
      balanceamount: 500
    };
    
    console.log('Before formatPoinvoiceForAPI:');
    console.log(`  paymentdata type: ${typeof samplePoinvoice.paymentdata}`);
    console.log(`  paymentdata value: ${JSON.stringify(samplePoinvoice.paymentdata)}`);
    
    const formatted = formatPoinvoiceForAPI(samplePoinvoice);
    
    console.log('After formatPoinvoiceForAPI:');
    console.log(`  paymentdata type: ${typeof formatted.paymentdata}`);
    console.log(`  paymentdata value: ${JSON.stringify(formatted.paymentdata)}`);

    // Step 5: Test the full service flow
    console.log('\n5. TESTING FULL SERVICE FLOW:');
    
    const { PoinvoiceService } = await import('./build/services/poinvoice.service.js');
    const service = new PoinvoiceService();
    
    for (const testId of [5, 16]) {
      console.log(`\nTesting service.findById for ID ${testId}:`);
      try {
        const serviceResult = await service.findById(testId.toString());
        console.log(`  Service result ID: ${serviceResult.id}`);
        console.log(`  paymentdata type: ${typeof serviceResult.paymentdata}`);
        console.log(`  paymentdata value: ${JSON.stringify(serviceResult.paymentdata)}`);
        console.log(`  All keys: ${Object.keys(serviceResult).join(', ')}`);
      } catch (error) {
        console.log(`  Service error: ${error.message}`);
      }
    }

    // Step 6: Test raw SQL with different approaches
    console.log('\n6. TESTING DIFFERENT RAW SQL APPROACHES:');
    
    // Test with explicit JSONB casting
    console.log('\nTesting with explicit JSONB handling:');
    const jsonbQuery = await prisma.$queryRawUnsafe(
      'SELECT id, paymentdata::text as paymentdata_text, paymentdata FROM poinvoice WHERE id = $1',
      5
    );
    
    if (jsonbQuery.length > 0) {
      const record = jsonbQuery[0];
      console.log(`  paymentdata (raw): ${JSON.stringify(record.paymentdata)}`);
      console.log(`  paymentdata_text: ${record.paymentdata_text}`);
      console.log(`  paymentdata type: ${typeof record.paymentdata}`);
    }

    // Test with JSON_EXTRACT or similar
    console.log('\nTesting with JSON operations:');
    const jsonQuery = await prisma.$queryRawUnsafe(
      'SELECT id, paymentdata, jsonb_typeof(paymentdata) as paymentdata_type FROM poinvoice WHERE id = $1',
      5
    );
    
    if (jsonQuery.length > 0) {
      const record = jsonQuery[0];
      console.log(`  paymentdata: ${JSON.stringify(record.paymentdata)}`);
      console.log(`  paymentdata_type: ${record.paymentdata_type}`);
    }

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPoinvoicePaymentData(); 