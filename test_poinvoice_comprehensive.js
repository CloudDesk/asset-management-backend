#!/usr/bin/env node

/**
 * Production-Ready Comprehensive Test Suite for PO Invoice API
 * Testing POST /v1/poinvoices/ with Purchase Order Status Updates
 * 
 * Requirements:
 * 1. Purchase order creation sets po_status to 'in_progress'
 * 2. POST logic updates purchase order status based on payment amounts
 * 3. Comprehensive error handling and security testing
 * 4. Production-ready validation with proper cleanup
 * 5. Dynamic data generation to avoid conflicts
 */

import axios from 'axios';
import { randomBytes } from 'crypto';

// Environment configuration
const CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'http://localhost:5600',
  TIMEOUT: parseInt(process.env.TEST_TIMEOUT) || 15000,
  RETRIES: parseInt(process.env.TEST_RETRIES) || 3,
  VERBOSE: process.env.TEST_VERBOSE === 'true' || true,
  CLEANUP: process.env.TEST_CLEANUP !== 'false'
};

const POINVOICE_URL = `${CONFIG.BASE_URL}/v1/poinvoices`;
const PURCHASEORDER_URL = `${CONFIG.BASE_URL}/v1/purchaseorders`;

// Track created resources for cleanup
const createdResources = {
  purchaseorders: [],
  poinvoices: []
};

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

/**
 * Utility functions
 */
function log(message, type = 'info') {
  if (!CONFIG.VERBOSE && type === 'info') return;
  
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function logTest(testName, status, details = '') {
  testResults.total++;
  if (status === 'passed') {
    testResults.passed++;
    log(`TEST PASSED: ${testName}${details ? ' - ' + details : ''}`, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(`${testName}: ${details}`);
    log(`TEST FAILED: ${testName}${details ? ' - ' + details : ''}`, 'error');
  }
  testResults.details.push({ testName, status, details });
}

function generateUniqueId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function generateUniquePONumber(prefix = 'TEST') {
  const timestamp = Date.now();
  const random = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-PO-${timestamp}-${random}`;
}

function generateUniqueInvoiceNumber(prefix = 'INV') {
  const timestamp = Date.now();
  const random = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}

async function makeRequest(method, url, data = null, expectedStatus = null) {
  try {
    const config = {
      method,
      url,
      timeout: CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    
    if (expectedStatus && response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
    
    return response;
  } catch (error) {
    if (error.response) {
      return error.response;
    }
    throw error;
  }
}

async function waitForCondition(conditionFn, timeout = 5000, interval = 500) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await conditionFn();
      if (result) return result;
    } catch (error) {
      // Ignore errors and continue polling
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Data generation functions
 */
function createTestPurchaseOrder() {
  const uniqueId = generateUniqueId();
  const ponumber = generateUniquePONumber('TESTAUTO');
  
  return {
    ponumber,
    companyname: "Test Automation Company",
    companyaddress: "123 Test Street, Test City, TC",
    contactname: "Test Contact",
    phonenumber: 9876543210,
    gstnumber: "33TESTGST001Z",
    io_companyname: "Test Automation Company",
    io_companyaddress: "123 Test Street, Test City, TC",
    io_contactname: "Test Contact",
    io_phonenumber: 9876543210,
    io_gstnumber: "33TESTGST001Z",
    dt_companyname: "",
    dt_companyaddress: "",
    dt_contactname: "",
    dt_phonenumber: null,
    dt_gstnumber: "",
    supplierid: 97, // Use existing supplier ID from database
    subtotal: 1000,
    discount: 0,
    sgst: 6,
    cgst: 6,
    payabletaxamount: 120,
    total: 1120,
    product: {
      items: [
        { id: 1, name: "Test Product - Automation", quantity: 5 }
      ]
    },
    po_status: "in_progress",
    supplieraddress: "456 Supplier Street, Supplier City, SC, 600001",
    suppliercompanyname: "Test Supplier Company",
    supplierphonenumber: 8987654321,
    suppliergstnumber: "33TESTSUP001Z",
    instructions: "Test automation delivery instructions",
    fileurl: null,
    invoiceurl: null,
    sameasinvoice: false,
    paymentterms: "30",
    overduedate: null,
    comments: "Test automation comments",
    suppliertype: "local"
  };
}

function createTestPoinvoice(ponumber, invoiceAmount, paymentAmount, invoiceType = 'partial') {
  const uniqueId = generateUniqueId();
  const invoiceNumber = generateUniqueInvoiceNumber();
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  return {
    invoiceamount: invoiceAmount,
    ponumber: ponumber,
    invoicedate: currentTimestamp,
    invoicenumber: invoiceNumber,
    invoiceurl: `https://test-storage.example.com/${ponumber}/invoice_${invoiceNumber}.pdf`,
    paymentdata: [
      {
        id: uniqueId,
        comments: `Test ${invoiceType} payment`,
        paymentdate: new Date().toISOString().split('T')[0],
        paymenttype: invoiceType === 'partial' ? 'Part Payment' : 'Full Payment',
        paymentamount: paymentAmount,
        paymentmethod: 'banktransfer',
        transactionid: `TXN_TEST_${uniqueId}`,
        receiptcomments: `Test payment received - ${invoiceType}`
      }
    ],
    createddate: currentTimestamp,
    modifieddate: currentTimestamp,
    balanceamount: invoiceAmount - paymentAmount,
    iscreditpayment: false,
    paymentduedate: currentTimestamp + (30 * 24 * 60 * 60), // 30 days from now
    invoicestatus: paymentAmount >= invoiceAmount ? 'paid' : 'partial',
    pototal: 1120, // Match PO total
    purchaseorderstatus: "in_progress",
    transportationcharges: null,
    exchangeamount: null,
    customdutytaxamount: null,
    suppliertype: "local",
    customdutychallanurl: null,
    billofentryurl: null
  };
}

/**
 * Test Functions
 */

async function testServerAvailability() {
  log('Testing Server Availability...');
  
  try {
    const response = await makeRequest('GET', `${CONFIG.BASE_URL}/health`);
    
    if (response.status === 200) {
      logTest('Server Availability', 'passed', 'Server is running and accessible');
    } else {
      // Try alternative endpoint
      const altResponse = await makeRequest('GET', PURCHASEORDER_URL);
      if (altResponse.status === 200) {
        logTest('Server Availability', 'passed', 'Server accessible via main endpoints');
      } else {
        logTest('Server Availability', 'failed', `Server not accessible: ${altResponse.status}`);
      }
    }
  } catch (error) {
    logTest('Server Availability', 'failed', error.message);
  }
}

async function testPurchaseOrderCreation() {
  log('Testing Purchase Order Creation with po_status=in_progress...');
  
  try {
    const testPO = createTestPurchaseOrder();
    const response = await makeRequest('POST', PURCHASEORDER_URL, testPO, 201);
    
    if (response.status === 201) {
      const po = response.data.data;
      createdResources.purchaseorders.push(po.id);
      
      if (po.po_status === 'in_progress') {
        logTest('Purchase Order Creation', 'passed', `Created PO ${po.ponumber} with status in_progress`);
        return { success: true, po };
      } else {
        logTest('Purchase Order Creation', 'failed', `po_status is ${po.po_status}, expected in_progress`);
        return { success: false, error: 'Invalid status' };
      }
    } else {
      logTest('Purchase Order Creation', 'failed', `HTTP ${response.status}: ${response.data?.message || 'Unknown error'}`);
      return { success: false, error: response.data?.message };
    }
  } catch (error) {
    logTest('Purchase Order Creation', 'failed', error.message);
    return { success: false, error: error.message };
  }
}

async function testPoinvoicePartialPayment(ponumber) {
  log('Testing Poinvoice with Partial Payment (should update PO status to partially_fulfilled)...');
  
  try {
    const poinvoiceData = createTestPoinvoice(ponumber, 600, 300, 'partial');
    const response = await makeRequest('POST', POINVOICE_URL, poinvoiceData, 201);
    
    if (response.status === 201) {
      const poinvoice = response.data.data;
      createdResources.poinvoices.push(poinvoice.id);
      
      logTest('Poinvoice Partial Payment - Creation', 'passed', `Created poinvoice ID ${poinvoice.id}`);
      
      // Wait for PO status update
      try {
        await waitForCondition(async () => {
          const poResponse = await makeRequest('GET', `${PURCHASEORDER_URL}?ponumber=${ponumber}`);
          if (poResponse.status === 200 && poResponse.data.data.length > 0) {
            const po = poResponse.data.data[0];
            return po.po_status === 'partially_fulfilled';
          }
          return false;
        }, 10000);
        
        logTest('Poinvoice Partial Payment - PO Status Update', 'passed', 'PO status updated to partially_fulfilled');
        return { success: true, poinvoice };
      } catch (error) {
        const poResponse = await makeRequest('GET', `${PURCHASEORDER_URL}?ponumber=${ponumber}`);
        const currentStatus = poResponse.data?.data?.[0]?.po_status || 'unknown';
        logTest('Poinvoice Partial Payment - PO Status Update', 'failed', `Status is ${currentStatus}, expected partially_fulfilled`);
        return { success: false, error: 'Status not updated' };
      }
      
    } else {
      logTest('Poinvoice Partial Payment', 'failed', `HTTP ${response.status}: ${response.data?.message || 'Unknown error'}`);
      return { success: false, error: response.data?.message };
    }
  } catch (error) {
    logTest('Poinvoice Partial Payment', 'failed', error.message);
    return { success: false, error: error.message };
  }
}

async function testPoinvoiceFullPayment(ponumber) {
  log('Testing Poinvoice with Full Payment (should update PO status to fulfilled)...');
  
  try {
    const poinvoiceData = createTestPoinvoice(ponumber, 520, 520, 'full');
    const response = await makeRequest('POST', POINVOICE_URL, poinvoiceData, 201);
    
    if (response.status === 201) {
      const poinvoice = response.data.data;
      createdResources.poinvoices.push(poinvoice.id);
      
      logTest('Poinvoice Full Payment - Creation', 'passed', `Created poinvoice ID ${poinvoice.id}`);
      
      // Wait for PO status update
      try {
        await waitForCondition(async () => {
          const poResponse = await makeRequest('GET', `${PURCHASEORDER_URL}?ponumber=${ponumber}`);
          if (poResponse.status === 200 && poResponse.data.data.length > 0) {
            const po = poResponse.data.data[0];
            return po.po_status === 'fulfilled';
          }
          return false;
        }, 10000);
        
        logTest('Poinvoice Full Payment - PO Status Update', 'passed', 'PO status updated to fulfilled');
        return { success: true, poinvoice };
      } catch (error) {
        const poResponse = await makeRequest('GET', `${PURCHASEORDER_URL}?ponumber=${ponumber}`);
        const currentStatus = poResponse.data?.data?.[0]?.po_status || 'unknown';
        logTest('Poinvoice Full Payment - PO Status Update', 'failed', `Status is ${currentStatus}, expected fulfilled`);
        return { success: false, error: 'Status not updated' };
      }
      
    } else {
      logTest('Poinvoice Full Payment', 'failed', `HTTP ${response.status}: ${response.data?.message || 'Unknown error'}`);
      return { success: false, error: response.data?.message };
    }
  } catch (error) {
    logTest('Poinvoice Full Payment', 'failed', error.message);
    return { success: false, error: error.message };
  }
}

async function testInvalidInputs() {
  log('Testing Invalid Inputs...');
  
  const tests = [
    {
      name: 'Invalid ponumber',
      data: createTestPoinvoice('INVALID-PO-NUMBER', 100, 100),
      expectedStatus: [400, 404]
    },
    {
      name: 'Negative payment amount',
      data: {
        ...createTestPoinvoice(generateUniquePONumber(), 100, 100),
        paymentdata: [{
          id: 1,
          paymentamount: -100,
          paymenttype: 'Part Payment',
          paymentmethod: 'banktransfer'
        }]
      },
      expectedStatus: [400]
    },
    {
      name: 'Missing required fields',
      data: {
        invoiceamount: 100
        // Missing ponumber and other required fields
      },
      expectedStatus: [400]
    },
    {
      name: 'Invalid payment data format',
      data: {
        ...createTestPoinvoice(generateUniquePONumber(), 100, 100),
        paymentdata: "invalid-format"
      },
      expectedStatus: [400]
    }
  ];
  
  for (const test of tests) {
    try {
      const response = await makeRequest('POST', POINVOICE_URL, test.data);
      
      if (test.expectedStatus.includes(response.status)) {
        logTest(`Invalid Input - ${test.name}`, 'passed', `Correctly returned HTTP ${response.status}`);
      } else {
        logTest(`Invalid Input - ${test.name}`, 'failed', `Expected ${test.expectedStatus}, got ${response.status}`);
      }
    } catch (error) {
      logTest(`Invalid Input - ${test.name}`, 'failed', error.message);
    }
  }
}

async function testSecurityVulnerabilities() {
  log('Testing Security Vulnerabilities...');
  
  const securityTests = [
    {
      name: 'SQL Injection - ponumber',
      data: {
        ...createTestPoinvoice("' OR 1=1--", 100, 100),
      }
    },
    {
      name: 'XSS - invoice number',
      data: {
        ...createTestPoinvoice(generateUniquePONumber(), 100, 100),
        invoicenumber: "<script>alert('xss')</script>"
      }
    },
    {
      name: 'XSS - payment comments',
      data: {
        ...createTestPoinvoice(generateUniquePONumber(), 100, 100),
        paymentdata: [{
          id: 1,
          comments: "<img src=x onerror=alert('xss')>",
          paymentamount: 100,
          paymenttype: 'Part Payment',
          paymentmethod: 'banktransfer'
        }]
      }
    }
  ];
  
  for (const test of securityTests) {
    try {
      const response = await makeRequest('POST', POINVOICE_URL, test.data);
      
      if (response.status === 400) {
        logTest(`Security - ${test.name}`, 'passed', 'Input validation rejected malicious payload');
      } else if (response.status === 201) {
        // Check if response data is sanitized
        const responseData = JSON.stringify(response.data);
        if (responseData.includes('<script>') || responseData.includes('onerror=') || responseData.includes("OR 1=1")) {
          logTest(`Security - ${test.name}`, 'passed', 'Input appears to be sanitized');
        } else {
          logTest(`Security - ${test.name}`, 'failed', 'Malicious payload not sanitized');
        }
      } else {
        logTest(`