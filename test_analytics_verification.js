
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

const API_URL = 'http://localhost:5600/v1/analytics';

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: []
};

async function curl(command) {
  try {
    // console.log(`Executing: ${command}`);
    const { stdout, stderr } = await execPromise(command);
    return stdout;
  } catch (error) {
    console.error(`Execution error: ${error.message}`);
    return null;
  }
}

function parseResponse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error(`Error parsing JSON:`);
    return null;
  }
}

function logTestResult(testName, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName} - PASSED ${details}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName} - FAILED ${details}`);
    testResults.errors.push(`${testName}: ${details}`);
  }
}

async function testInventoryHealth() {
  console.log('\n=== Module A: Inventory Health ===');
  const response = await curl(`curl -s "${API_URL}/inventory-health"`);
  const parsed = parseResponse(response);
  
  if (parsed && parsed.success && parsed.data) {
    const d = parsed.data;
    const checks = 
      typeof d.lowStockCount === 'number' &&
      typeof d.outOfStockCount === 'number' &&
      Array.isArray(d.distribution) &&
      Array.isArray(d.lowStockProducts);
      
    logTestResult('Structure Check', checks, checks ? `Low Stock: ${d.lowStockCount}, Alerts: ${d.lowStockProducts.length}` : 'Invalid structure');
    
    if (d.lowStockProducts && d.lowStockProducts.length > 0) {
       console.log('   Sample Alert:', JSON.stringify(d.lowStockProducts[0].name));
    }
    return checks;
  } else {
    logTestResult('API Call', false, parsed ? parsed.error : 'Failed');
    return false;
  }
}

async function testFulfillment() {
  console.log('\n=== Module B: Fulfillment ===');
  const response = await curl(`curl -s "${API_URL}/fulfillment-summary"`);
  const parsed = parseResponse(response);
  
  if (parsed && parsed.success && parsed.data) {
    const d = parsed.data;
    const checks = 
      typeof d.pending === 'number' &&
      typeof d.ready_to_dispatch === 'number' &&
      typeof d.shipped_today === 'number';
      
    logTestResult('Structure Check', checks, checks ? `Pending: ${d.pending}, Shipped Today: ${d.shipped_today}` : 'Invalid structure');
    return checks;
  } else {
    logTestResult('API Call', false, parsed ? parsed.error : 'Failed');
    return false;
  }
}

async function testSalesVelocity() {
  console.log('\n=== Module C: Sales Velocity ===');
  const response = await curl(`curl -s "${API_URL}/sales-velocity"`);
  const parsed = parseResponse(response);
  
  if (parsed && parsed.success && parsed.data) {
    const d = parsed.data;
    const checks = 
      typeof d.todayRevenue === 'number' &&
      Array.isArray(d.platformSplit);
      
    logTestResult('Structure Check', checks, checks ? `Revenue Today: ${d.todayRevenue}` : 'Invalid structure');
    return checks;
  } else {
    logTestResult('API Call', false, parsed ? parsed.error : 'Failed');
    return false;
  }
}

async function testSupplyChain() {
  console.log('\n=== Module D: Supply Chain ===');
  const response = await curl(`curl -s "${API_URL}/supply-chain"`);
  const parsed = parseResponse(response);
  
  if (parsed && parsed.success && parsed.data) {
    const d = parsed.data;
    const checks = 
      typeof d.open_pos === 'number' &&
      typeof d.pending_prs === 'number';
      
    logTestResult('Structure Check', checks, checks ? `Open POs: ${d.open_pos}` : 'Invalid structure');
    return checks;
  } else {
    logTestResult('API Call', false, parsed ? parsed.error : 'Failed');
    return false;
  }
}

async function run() {
  await testInventoryHealth();
  await testFulfillment();
  await testSalesVelocity();
  await testSupplyChain();
  
  console.log('\n=== Summary ===');
  console.log(`Passed: ${testResults.passed}/${testResults.total}`);
  if (testResults.failed > 0) process.exit(1);
}

run();
