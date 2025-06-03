#!/bin/bash

# Purchase Order Status Update Tests - Quick Runner
# Usage: ./run_poinvoice_tests.sh [test_type]
# test_type: all, quick, po-creation, status-update, security, performance

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:5600}"
TEST_VERBOSE="${TEST_VERBOSE:-true}"
TEST_CLEANUP="${TEST_CLEANUP:-true}"

echo -e "${BLUE}🚀 Purchase Order Status Update Logic Tests${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "API Base URL: ${API_BASE_URL}"
echo -e "Verbose: ${TEST_VERBOSE}"
echo -e "Cleanup: ${TEST_CLEANUP}"
echo ""

# Function to check if server is running
check_server() {
    echo -e "${YELLOW}📡 Checking server availability...${NC}"
    
    if curl -s "${API_BASE_URL}/health" > /dev/null 2>&1 || curl -s "${API_BASE_URL}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is running at ${API_BASE_URL}${NC}"
        return 0
    else
        echo -e "${RED}❌ Server is not running at ${API_BASE_URL}${NC}"
        echo -e "${YELLOW}💡 Please start the server first:${NC}"
        echo -e "   npm start"
        echo -e "   # or"
        echo -e "   node src/server.js"
        return 1
    fi
}

# Function to run comprehensive tests
run_comprehensive_tests() {
    echo -e "${BLUE}🔬 Running Comprehensive Test Suite${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    
    export API_BASE_URL TEST_VERBOSE TEST_CLEANUP
    
    if node test_poinvoice_status_update_comprehensive.js; then
        echo -e "${GREEN}✅ Comprehensive tests completed${NC}"
        return 0
    else
        echo -e "${RED}❌ Comprehensive tests failed${NC}"
        return 1
    fi
}

# Function to run quick smoke tests
run_quick_tests() {
    echo -e "${BLUE}⚡ Running Quick Smoke Tests${NC}"
    echo -e "${BLUE}════════════════════════════════${NC}"
    
    # Test server availability
    if ! curl -s "${API_BASE_URL}/health" > /dev/null 2>&1; then
        echo -e "${RED}❌ Server not available${NC}"
        return 1
    fi
    
    # Test purchase order creation
    echo -e "${YELLOW}Testing PO creation...${NC}"
    PO_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/v1/purchaseorders" \
        -H "Content-Type: application/json" \
        -d '{
            "ponumber": "TEST-SMOKE-'$(date +%s)'",
            "companyname": "Test Company",
            "total": 1000,
            "po_status": "in_progress",
            "supplierid": 97
        }')
    
    if echo "$PO_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ PO creation working${NC}"
        
        # Extract ponumber for invoice test
        PONUMBER=$(echo "$PO_RESPONSE" | grep -o '"ponumber":"[^"]*"' | cut -d'"' -f4)
        
        # Test poinvoice creation
        echo -e "${YELLOW}Testing PO Invoice creation...${NC}"
        INVOICE_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/v1/poinvoices" \
            -H "Content-Type: application/json" \
            -d '{
                "ponumber": "'$PONUMBER'",
                "invoiceamount": 500,
                "paymentdata": [{"paymentamount": 300}],
                "invoicenumber": "TEST-INV-'$(date +%s)'"
            }')
        
        if echo "$INVOICE_RESPONSE" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ PO Invoice creation working${NC}"
            echo -e "${GREEN}✅ Quick smoke tests passed${NC}"
            return 0
        else
            echo -e "${RED}❌ PO Invoice creation failed${NC}"
            echo "$INVOICE_RESPONSE"
            return 1
        fi
    else
        echo -e "${RED}❌ PO creation failed${NC}"
        echo "$PO_RESPONSE"
        return 1
    fi
}

# Function to test specific scenarios
test_po_creation() {
    echo -e "${BLUE}🏗️  Testing Purchase Order Creation${NC}"
    
    node -e "
    import { testPurchaseOrderCreation } from './test_poinvoice_status_update_comprehensive.js';
    testPurchaseOrderCreation().then(result => {
        console.log('Result:', result);
        process.exit(result.success ? 0 : 1);
    }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
    "
}

test_status_updates() {
    echo -e "${BLUE}🔄 Testing Status Update Logic${NC}"
    
    # First create a test PO
    echo -e "${YELLOW}Creating test PO...${NC}"
    
    node -e "
    import { createTestPurchaseOrder, testPoinvoicePartialPayment, testPoinvoiceFullPayment } from './test_poinvoice_status_update_comprehensive.js';
    import axios from 'axios';
    
    async function testStatusUpdates() {
        try {
            // Create test PO
            const testPO = createTestPurchaseOrder();
            const response = await axios.post('${API_BASE_URL}/v1/purchaseorders', testPO);
            
            if (response.status === 201) {
                const ponumber = response.data.data.ponumber;
                console.log('Created test PO:', ponumber);
                
                // Test partial payment
                console.log('Testing partial payment...');
                const partialResult = await testPoinvoicePartialPayment(ponumber);
                
                if (partialResult.success) {
                    console.log('✅ Partial payment test passed');
                    
                    // Test full payment
                    console.log('Testing full payment...');
                    const fullResult = await testPoinvoiceFullPayment(ponumber);
                    
                    if (fullResult.success) {
                        console.log('✅ Full payment test passed');
                        process.exit(0);
                    } else {
                        console.log('❌ Full payment test failed');
                        process.exit(1);
                    }
                } else {
                    console.log('❌ Partial payment test failed');
                    process.exit(1);
                }
            } else {
                console.log('❌ Failed to create test PO');
                process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }
    
    testStatusUpdates();
    "
}

test_security() {
    echo -e "${BLUE}🔒 Testing Security Vulnerabilities${NC}"
    
    # Test SQL injection
    echo -e "${YELLOW}Testing SQL injection prevention...${NC}"
    INJECTION_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/v1/poinvoices" \
        -H "Content-Type: application/json" \
        -d '{
            "ponumber": "'\'''; DROP TABLE poinvoice; --",
            "invoiceamount": 1000
        }')
    
    if echo "$INJECTION_RESPONSE" | grep -q '"success":false\|"error"'; then
        echo -e "${GREEN}✅ SQL injection properly handled${NC}"
    else
        echo -e "${YELLOW}⚠️  SQL injection test needs review${NC}"
    fi
    
    # Test XSS
    echo -e "${YELLOW}Testing XSS prevention...${NC}"
    XSS_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/v1/poinvoices" \
        -H "Content-Type: application/json" \
        -d '{
            "ponumber": "TEST-XSS",
            "paymentdata": [{"comments": "<script>alert(\"xss\")</script>"}]
        }')
    
    echo -e "${GREEN}✅ Security tests completed${NC}"
}

test_performance() {
    echo -e "${BLUE}⚡ Testing Performance${NC}"
    
    echo -e "${YELLOW}Creating test data for performance test...${NC}"
    
    # Create a test PO first
    PO_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/v1/purchaseorders" \
        -H "Content-Type: application/json" \
        -d '{
            "ponumber": "PERF-TEST-'$(date +%s)'",
            "companyname": "Performance Test",
            "total": 10000,
            "supplierid": 97
        }')
    
    if echo "$PO_RESPONSE" | grep -q '"success":true'; then
        PONUMBER=$(echo "$PO_RESPONSE" | grep -o '"ponumber":"[^"]*"' | cut -d'"' -f4)
        
        echo -e "${YELLOW}Running concurrent payment tests...${NC}"
        
        # Run multiple concurrent requests
        for i in {1..5}; do
            curl -s -X POST "${API_BASE_URL}/v1/poinvoices" \
                -H "Content-Type: application/json" \
                -d '{
                    "ponumber": "'$PONUMBER'",
                    "invoiceamount": 1000,
                    "invoicenumber": "PERF-'$i'-'$(date +%s)'",
                    "paymentdata": [{"paymentamount": '$(($i * 100))'}]
                }' &
        done
        
        wait # Wait for all background jobs to complete
        
        echo -e "${GREEN}✅ Performance tests completed${NC}"
    else
        echo -e "${RED}❌ Failed to create test PO for performance test${NC}"
    fi
}

# Main script logic
case "${1:-all}" in
    "all")
        check_server && run_comprehensive_tests
        ;;
    "quick")
        check_server && run_quick_tests
        ;;
    "po-creation")
        check_server && test_po_creation
        ;;
    "status-update")
        check_server && test_status_updates
        ;;
    "security")
        check_server && test_security
        ;;
    "performance")
        check_server && test_performance
        ;;
    "help"|"-h"|"--help")
        echo -e "${BLUE}Usage: ./run_poinvoice_tests.sh [test_type]${NC}"
        echo ""
        echo -e "${YELLOW}Available test types:${NC}"
        echo -e "  all           - Run comprehensive test suite (default)"
        echo -e "  quick         - Run quick smoke tests"
        echo -e "  po-creation   - Test purchase order creation only"
        echo -e "  status-update - Test status update logic only"
        echo -e "  security      - Test security vulnerabilities"
        echo -e "  performance   - Test performance and concurrency"
        echo -e "  help          - Show this help message"
        echo ""
        echo -e "${YELLOW}Environment variables:${NC}"
        echo -e "  API_BASE_URL  - Base URL for API (default: http://localhost:5600)"
        echo -e "  TEST_VERBOSE  - Enable verbose output (default: true)"
        echo -e "  TEST_CLEANUP  - Clean up test data (default: true)"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo -e "  ./run_poinvoice_tests.sh quick"
        echo -e "  API_BASE_URL=http://localhost:3000 ./run_poinvoice_tests.sh all"
        echo -e "  TEST_CLEANUP=false ./run_poinvoice_tests.sh status-update"
        ;;
    *)
        echo -e "${RED}❌ Unknown test type: $1${NC}"
        echo -e "${YELLOW}Use './run_poinvoice_tests.sh help' for usage information${NC}"
        exit 1
        ;;
esac 