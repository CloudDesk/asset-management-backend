#!/usr/bin/env npx tsx

/**
 * Test script to verify dynamic schema generation functionality
 * Run with: npx tsx test_schema_generation.ts
 */

import { getModelFields, generateSwaggerSchema, generateCRUDSchemas } from './src/utils/swaggerSchemaBuilder.js';
import { getProductSchemas } from './src/swagger/product.swagger.js';

async function testSchemaGeneration() {
  console.log('🧪 Testing Dynamic Schema Generation');
  console.log('=====================================\n');

  try {
    // Test 1: Get model fields for product
    console.log('1️⃣ Testing getModelFields for product...');
    const productFields = await getModelFields('product');
    console.log(`✅ Found ${productFields.length} fields in product table:`);
    productFields.forEach(field => {
      console.log(`   - ${field.column_name} (${field.data_type}${field.is_nullable === 'YES' ? ', nullable' : ''})`);
    });
    console.log('');

    // Test 2: Generate Swagger schema for product
    console.log('2️⃣ Testing generateSwaggerSchema for product...');
    const createSchema = await generateSwaggerSchema('product', 'create');
    const updateSchema = await generateSwaggerSchema('product', 'update');
    const responseSchema = await generateSwaggerSchema('product', 'response');
    
    console.log(`✅ Create schema generated with ${Object.keys(createSchema.properties).length} properties`);
    console.log(`   Required fields: [${createSchema.required.join(', ')}]`);
    console.log(`✅ Update schema generated with ${Object.keys(updateSchema.properties).length} properties`);
    console.log(`   Required fields: [${updateSchema.required.join(', ')}]`);
    console.log(`✅ Response schema generated with ${Object.keys(responseSchema.properties).length} properties`);
    console.log('');

    // Test 3: Generate CRUD schemas
    console.log('3️⃣ Testing generateCRUDSchemas for product...');
    const crudSchemas = await generateCRUDSchemas('product');
    console.log('✅ CRUD schemas generated successfully:');
    console.log(`   - create: ${Object.keys(crudSchemas.create.properties).length} properties`);
    console.log(`   - update: ${Object.keys(crudSchemas.update.properties).length} properties`);
    console.log(`   - response: ${Object.keys(crudSchemas.response.properties).length} properties`);
    console.log(`   - success: ${Object.keys(crudSchemas.success.properties).length} properties`);
    console.log(`   - list: ${Object.keys(crudSchemas.list.properties).length} properties`);
    console.log(`   - error: ${Object.keys(crudSchemas.error.properties).length} properties`);
    console.log('');

    // Test 4: Test product-specific schemas
    console.log('4️⃣ Testing getProductSchemas...');
    const productSchemas = await getProductSchemas();
    console.log('✅ Product schemas loaded successfully');
    console.log('');

    // Test 5: Display sample schema structure
    console.log('5️⃣ Sample Create Schema Structure:');
    console.log('=====================================');
    console.log(JSON.stringify(createSchema, null, 2));
    console.log('');

    // Test 6: Test with other models
    console.log('6️⃣ Testing with other models...');
    const models = ['supplier', 'stock', 'picklist'];
    
    for (const model of models) {
      try {
        const fields = await getModelFields(model);
        console.log(`✅ ${model}: ${fields.length} fields found`);
      } catch (error) {
        console.log(`❌ ${model}: Error - ${error}`);
      }
    }
    console.log('');

    console.log('🎉 All schema generation tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Schema generation test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSchemaGeneration().catch(console.error); 