#!/bin/bash

# Product API Test Script
# Tests all CRUD operations for the product endpoints

BASE_URL="http://localhost:5600/v1/products"
CONTENT_TYPE="Content-Type: application/json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local expected_status="$2"
    local curl_command="$3"
    
    echo -e "\n=== $test_name ==="
    echo "Expected Status: $expected_status"
    
    # Execute curl command and capture both response and status code
    response=$(eval "$curl_command" 2>/dev/null)
    status_code=$(echo "$response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    echo "Actual Status: $status_code"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
    fi
    
    echo "Response: $response_body"
    echo "---"
}

echo -e "${BLUE}🚀 Starting Product API Tests${NC}"
echo "================================"

# Test 1: GET /products (list all)
echo -e "\n${YELLOW}📋 Testing GET /products (list all)${NC}"
run_test "GET /products - List all products" "200" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' '$BASE_URL'"

# Test 2: GET /products/:id with invalid ID
echo -e "\n${YELLOW}🔍 Testing GET /products/:id with invalid ID${NC}"
run_test "GET /products/invalid-id - Invalid integer format" "400" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' '$BASE_URL/invalid-id'"

# Test 3: GET /products/:id with non-existent ID
echo -e "\n${YELLOW}🔍 Testing GET /products/:id with non-existent ID${NC}"
run_test "GET /products/999999 - Product not found" "404" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' '$BASE_URL/999999'"

# Test 4: POST /products with valid data
echo -e "\n${YELLOW}➕ Testing POST /products with valid data${NC}"
run_test "POST /products - Create valid product" "201" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' -X POST '$BASE_URL' -H 'Content-Type: application/json' -d '{\"name\": \"Test Product\"}'"

# Test 5: POST /products with missing required fields
echo -e "\n${YELLOW}➕ Testing POST /products with missing required fields${NC}"
run_test "POST /products - Missing required fields" "400" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' -X POST '$BASE_URL' -H 'Content-Type: application/json' -d '{\"description\": \"Missing name field\"}'"

# Test 6: POST /products with empty body
echo -e "\n${YELLOW}➕ Testing POST /products with empty body${NC}"
run_test "POST /products - Empty body" "400" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' -X POST '$BASE_URL' -H 'Content-Type: application/json' -d '{}'"

# Test 7: PUT /products/:id with invalid ID
echo -e "\n${YELLOW}✏️ Testing PUT /products/:id with invalid ID${NC}"
run_test "PUT /products/invalid-id - Invalid integer format" "400" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' -X PUT '$BASE_URL/invalid-id' -H 'Content-Type: application/json' -d '{\"name\": \"Updated Product\"}'"

# Test 8: PUT /products/:id with non-existent ID
echo -e "\n${YELLOW}✏️ Testing PUT /products/:id with non-existent ID${NC}"
run_test "PUT /products/999999 - Product not found" "404" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' -X PUT '$BASE_URL/999999' -H 'Content-Type: application/json' -d '{\"name\": \"Updated Product\"}'"

# Test 9: GET /products with filters
echo -e "\n${YELLOW}🔍 Testing GET /products with filters${NC}"
run_test "GET /products?category=Electronics&page=1&limit=5 - Filtered list" "200" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' '$BASE_URL?category=Electronics&page=1&limit=5'"

# Test 10: DELETE /products/:id with invalid ID
echo -e "\n${YELLOW}🗑️ Testing DELETE /products/:id with invalid ID${NC}"
run_test "DELETE /products/invalid-id - Invalid integer format" "400" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' -X DELETE '$BASE_URL/invalid-id'"

# Test 11: DELETE /products/:id with non-existent ID
echo -e "\n${YELLOW}🗑️ Testing DELETE /products/:id with non-existent ID${NC}"
run_test "DELETE /products/999999 - Product not found" "404" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' -X DELETE '$BASE_URL/999999'"

# Test 12-16: Create multiple products for pagination testing
echo -e "\n${YELLOW}➕ Creating multiple products for pagination testing${NC}"
for i in {1..5}; do
    response=$(curl -s -w 'HTTPSTATUS:%{http_code}' -X POST "$BASE_URL" -H 'Content-Type: application/json' -d "{\"name\": \"Bulk Product $i\"}")
    status_code=$(echo "$response" | tail -n1 | grep -o '[0-9]*$')
    if [ "$status_code" = "201" ]; then
        echo "✅ Created bulk product $i"
    else
        echo "❌ Failed to create bulk product $i"
    fi
done

# Test 17: GET /products with pagination
echo -e "\n${YELLOW}📄 Testing GET /products with pagination${NC}"
run_test "GET /products?page=1&limit=2 - Pagination test" "200" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' '$BASE_URL?page=1&limit=2'"

# Test 18: POST /products with duplicate data (should be allowed)
echo -e "\n${YELLOW}➕ Testing POST /products with potential duplicate data${NC}"
# First creation
response1=$(curl -s -w 'HTTPSTATUS:%{http_code}' -X POST "$BASE_URL" -H 'Content-Type: application/json' -d '{"name": "Duplicate Test Product"}')
status1=$(echo "$response1" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
echo "First creation: Status $status1"

# Second creation (duplicate)
response2=$(curl -s -w 'HTTPSTATUS:%{http_code}' -X POST "$BASE_URL" -H 'Content-Type: application/json' -d '{"name": "Duplicate Test Product"}')
status2=$(echo "$response2" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
echo "Second creation: Status $status2"

run_test "POST /products - Duplicate allowed" "201" \
    "echo '$response2'"

# Test 19: POST /products with comprehensive data
echo -e "\n${YELLOW}➕ Testing POST /products with comprehensive data${NC}"
run_test "POST /products - Comprehensive product data" "201" \
    "curl -s -w 'HTTPSTATUS:%{http_code}' -X POST '$BASE_URL' -H 'Content-Type: application/json' -d '{\"name\": \"Premium Organic Oil\", \"shortdescription\": \"High quality organic oil\", \"fulldescription\": \"Premium organic oil sourced from sustainable farms\", \"fragnancetype\": \"Floral\", \"volume\": 250, \"origincountry\": \"Italy\", \"organiccertified\": true, \"supplierid\": 1}'"

# Test 20: PUT /products/:id with valid data (get a valid ID first)
echo -e "\n${YELLOW}✏️ Testing PUT /products/:id with valid data${NC}"
# Get the latest product ID
latest_response=$(curl -s "$BASE_URL?limit=1")
latest_id=$(echo "$latest_response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ ! -z "$latest_id" ]; then
    run_test "PUT /products/$latest_id - Update existing product" "200" \
        "curl -s -w 'HTTPSTATUS:%{http_code}' -X PUT '$BASE_URL/$latest_id' -H 'Content-Type: application/json' -d '{\"volume\": 500, \"organiccertified\": false, \"discount\": 15}'"
else
    echo "❌ Could not get valid product ID for update test"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

# Summary
echo -e "\n${BLUE}📊 Test Summary${NC}"
echo "==============="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $((TOTAL_TESTS - PASSED_TESTS))"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please check the output above.${NC}"
    exit 1
fi 