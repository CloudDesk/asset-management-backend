import axios from 'axios';

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5600';
const STOCK_ENDPOINT = `${BASE_URL}/v1/stocks`;

// Test cases
const testCases = [
  {
    name: 'User Provided Payload - Valid Stock Creation',
    description: 'Test the exact payload provided by the user',
    payload: {
      "productId": "137",
      "serialNumber": "dad56as7dsa",
      "manufactureYear": "2025-06-03",
      "ecommercePublish": true,
      "releaseYear": "2025-06-05",
      "location": "chennai"
    },
    expectedStatus: 201,
    shouldPass: true
  },
  {
    name: 'Alternative Field Names - Snake Case',
    description: 'Test using snake_case field names',
    payload: {
      "product_id": "138",
      "serial_number": "test123abc",
      "manufacture_year": "2024-01-15",
      "ecommerce_publish": false,
      "release_year": "2024-02-01",
      "location": "mumbai"
    },
    expectedStatus: 201,
    shouldPass: true
  },
  {
    name: 'Numeric Year Format',
    description: 'Test using numeric years instead of date strings',
    payload: {
      "productId": "139",
      "serialNumber": "numeric2024",
      "manufactureYear": 2024,
      "ecommercePublish": false,
      "releaseYear": 2024,
      "location": "delhi"
    },
    expectedStatus: 201,
    shouldPass: true
  },
  {
    name: 'Minimal Valid Payload',
    description: 'Test with minimum required fields',
    payload: {
      "productId": "140",
      "location": "bangalore"
    },
    expectedStatus: 201,
    shouldPass: true
  },
  {
    name: 'With Quantity Fields',
    description: 'Test including quantity management fields',
    payload: {
      "productId": "141",
      "serialNumber": "qty_test_001",
      "location": "hyderabad",
      "quantity": 100,
      "availableQuantity": 80,
      "soldQuantity": 20,
      "batchNumber": "BATCH001"
    },
    expectedStatus: 201,
    shouldPass: true
  },
  {
    name: 'Empty Payload',
    description: 'Test with empty payload - should fail validation',
    payload: {},
    expectedStatus: 400,
    shouldPass: false,
    expectedError: 'validation'
  },
  {
    name: 'Invalid Manufacture Year',
    description: 'Test with invalid date format',
    payload: {
      "productId": "142",
      "serialNumber": "invalid_date",
      "manufactureYear": "invalid-date-format",
      "location": "pune"
    },
    expectedStatus: 400,
    shouldPass: false,
    expectedError: 'validation'
  },
  {
    name: 'Negative Quantities',
    description: 'Test with negative quantity values - should fail validation',
    payload: {
      "productId": "143",
      "serialNumber": "negative_qty",
      "location": "kolkata",
      "quantity": -10,
      "availableQuantity": -5
    },
    expectedStatus: 400,
    shouldPass: false,
    expectedError: 'validation'
  },
  {
    name: 'Inconsistent Quantities',
    description: 'Test with inconsistent quantity math - should fail business logic',
    payload: {
      "productId": "144",
      "serialNumber": "inconsistent_qty",
      "location": "ahmedabad",
      "quantity": 100,
      "availableQuantity": 60,
      "soldQuantity": 50  // 60 + 50 = 110, not 100
    },
    expectedStatus: 400,
    shouldPass: false,
    expectedError: 'business_logic'
  },
  {
    name: 'Sold Greater Than Available',
    description: 'Test sold quantity greater than available - should fail business logic',
    payload: {
      "productId": "145",
      "serialNumber": "sold_gt_available",
      "location": "surat",
      "availableQuantity": 30,
      "soldQuantity": 50  // Sold > Available
    },
    expectedStatus: 400,
    shouldPass: false,
    expectedError: 'business_logic'
  },
  {
    name: 'Very Long String Fields',
    description: 'Test with strings exceeding maximum length',
    payload: {
      "productId": "146",
      "serialNumber": "a".repeat(600), // Exceeds 500 char limit
      "location": "jaipur"
    },
    expectedStatus: 400,
    shouldPass: false,
    expectedError: 'validation'
  },
  {
    name: 'Duplicate Serial Number',
    description: 'Test creating stock with duplicate serial number',
    payload: {
      "productId": "147",
      "serialNumber": "dad56as7dsa", // Same as first test
      "location": "lucknow"
    },
    expectedStatus: 409,
    shouldPass: false,
    expectedError: 'duplicate'
  }
];

// Test runner
class StockPostTester {
  constructor() {
    this.results = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  async runTest(testCase) {
    console.log(`\n🧪 Running Test: ${testCase.name}`);
    console.log(`📝 Description: ${testCase.description}`);
    console.log(`📤 Payload:`, JSON.stringify(testCase.payload, null, 2));

    try {
      const startTime = Date.now();
      
      const response = await axios.post(STOCK_ENDPOINT, testCase.payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: function (status) {
          return status < 600; // Don't throw on any HTTP status
        }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`📥 Response Status: ${response.status}`);
      console.log(`⏱️  Response Time: ${responseTime}ms`);
      console.log(`📊 Response Data:`, JSON.stringify(response.data, null, 2));

      // Validate response
      const testResult = this.validateResponse(testCase, response);
      testResult.responseTime = responseTime;
      
      this.results.push(testResult);

      if (testResult.passed) {
        console.log(`✅ Test PASSED`);
        this.passedTests++;
      } else {
        console.log(`❌ Test FAILED: ${testResult.reason}`);
        this.failedTests++;
      }

    } catch (error) {
      console.log(`💥 Test ERROR:`, error.message);
      
      const testResult = {
        testName: testCase.name,
        passed: false,
        reason: `Network/Request Error: ${error.message}`,
        expectedStatus: testCase.expectedStatus,
        actualStatus: null,
        responseTime: 0
      };
      
      this.results.push(testResult);
      this.failedTests++;
    }
  }

  validateResponse(testCase, response) {
    const result = {
      testName: testCase.name,
      passed: false,
      reason: '',
      expectedStatus: testCase.expectedStatus,
      actualStatus: response.status,
      responseData: response.data
    };

    // Check status code
    if (response.status !== testCase.expectedStatus) {
      result.reason = `Expected status ${testCase.expectedStatus}, got ${response.status}`;
      return result;
    }

    // Check response structure for successful requests
    if (testCase.shouldPass && response.status >= 200 && response.status < 300) {
      if (!response.data.success) {
        result.reason = 'Expected success=true in response';
        return result;
      }
      
      if (!response.data.data) {
        result.reason = 'Expected data object in response';
        return result;
      }

      if (!response.data.message) {
        result.reason = 'Expected message in response';
        return result;
      }
    }

    // Check error response structure for failed requests
    if (!testCase.shouldPass && response.status >= 400) {
      if (response.data.success !== false) {
        result.reason = 'Expected success=false in error response';
        return result;
      }

      if (!response.data.message) {
        result.reason = 'Expected error message in response';
        return result;
      }

      if (!response.data.details) {
        result.reason = 'Expected error details in response';
        return result;
      }
    }

    // Additional validation for specific error types
    if (testCase.expectedError === 'validation' && !response.data.validationFailed && !response.data.errors) {
      result.reason = 'Expected validation error indicators';
      return result;
    }

    if (testCase.expectedError === 'business_logic' && !response.data.businessLogicError) {
      result.reason = 'Expected business logic error indicator';
      return result;
    }

    if (testCase.expectedError === 'duplicate' && !response.data.duplicateError && !response.data.constraintError) {
      result.reason = 'Expected duplicate/constraint error indicator';
      return result;
    }

    result.passed = true;
    result.reason = 'All validations passed';
    return result;
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Stock POST API Testing');
    console.log(`🎯 Target Endpoint: ${STOCK_ENDPOINT}`);
    console.log(`📋 Total Tests: ${testCases.length}\n`);

    const startTime = Date.now();

    for (const testCase of testCases) {
      await this.runTest(testCase);
      
      // Small delay between tests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    this.printSummary(totalTime);
  }

  printSummary(totalTime) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Execution Time: ${totalTime}ms`);
    console.log(`📋 Total Tests: ${testCases.length}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`📈 Success Rate: ${((this.passedTests / testCases.length) * 100).toFixed(1)}%`);

    if (this.failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.testName}: ${result.reason}`);
      });
    }

    console.log('\n📋 DETAILED RESULTS:');
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`   ${status} ${result.testName} (${result.responseTime}ms)`);
      if (!result.passed) {
        console.log(`      Reason: ${result.reason}`);
      }
    });

    if (this.passedTests === testCases.length) {
      console.log('\n🎉 ALL TESTS PASSED! The Stock POST API is production ready.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review and fix the issues before production deployment.');
    }
  }
}

// Run the tests
async function main() {
  const tester = new StockPostTester();
  await tester.runAllTests();
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the tests
main().catch(console.error);

export { StockPostTester, testCases }; 