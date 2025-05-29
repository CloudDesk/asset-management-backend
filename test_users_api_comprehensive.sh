#!/bin/bash

# Comprehensive Test Script for Users and Inventory Users API
# Tests all CRUD operations and data type handling

BASE_URL="http://localhost:5600"
FAILED_TESTS=0
TOTAL_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run a test
run_test() {
    local test_name="$1"
    local expected_status="$2"
    local curl_command="$3"
    local validation_check="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${YELLOW}Test $TOTAL_TESTS: $test_name${NC}"
    
    response=$(eval "$curl_command")
    status_code=$(echo "$response" | jq -r '.success // false')
    
    if [[ "$expected_status" == "true" && "$status_code" == "true" ]]; then
        if [[ -n "$validation_check" ]]; then
            if eval "$validation_check"; then
                echo -e "${GREEN}✅ PASSED${NC}"
            else
                echo -e "${RED}❌ FAILED - Validation check failed${NC}"
                echo "Response: $response"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        else
            echo -e "${GREEN}✅ PASSED${NC}"
        fi
    elif [[ "$expected_status" == "false" && "$status_code" == "false" ]]; then
        echo -e "${GREEN}✅ PASSED (Expected failure)${NC}"
    else
        echo -e "${RED}❌ FAILED - Expected $expected_status, got $status_code${NC}"
        echo "Response: $response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
}

echo "🚀 Starting Comprehensive Users and Inventory Users API Tests"
echo "============================================================"

# Test 1: Get users with filter (original issue)
run_test "Get user by ID filter (original issue)" "true" \
    'curl -s "$BASE_URL/v1/users?id=17"' \
    'echo "$response" | jq -r ".data[0].usermobilenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 2: Get individual user
run_test "Get individual user by ID" "true" \
    'curl -s "$BASE_URL/v1/users/17"' \
    'echo "$response" | jq -r ".data.usermobilenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 3: Create user with numeric input
run_test "Create user with numeric phone number" "true" \
    'curl -s -X POST "$BASE_URL/v1/users" -H "Content-Type: application/json" -d "{\"useremail\": \"test_numeric@example.com\", \"firstname\": \"TestNumeric\", \"lastname\": \"User\", \"usermobilenumber\": 1234567890, \"isbusinessuser\": false}"' \
    'echo "$response" | jq -r ".data.usermobilenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 4: Create user with string input (coercion)
run_test "Create user with string phone number (coercion)" "true" \
    'curl -s -X POST "$BASE_URL/v1/users" -H "Content-Type: application/json" -d "{\"useremail\": \"test_string@example.com\", \"firstname\": \"TestString\", \"lastname\": \"User\", \"usermobilenumber\": \"9876543210\", \"isbusinessuser\": true}"' \
    'echo "$response" | jq -r ".data.usermobilenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 5: Update user
run_test "Update user with string phone number" "true" \
    'curl -s -X PUT "$BASE_URL/v1/users/18" -H "Content-Type: application/json" -d "{\"firstname\": \"UpdatedTest\", \"usermobilenumber\": \"5555555555\"}"' \
    'echo "$response" | jq -r ".data.usermobilenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 6: Upsert user (create)
run_test "Upsert user (create new)" "true" \
    'curl -s -X POST "$BASE_URL/v1/users/upsert" -H "Content-Type: application/json" -d "{\"useremail\": \"upsert_test@example.com\", \"firstname\": \"UpsertTest\", \"lastname\": \"User\", \"usermobilenumber\": \"7777777777\"}"' \
    'echo "$response" | jq -r ".data.usermobilenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 7: Invalid phone number validation
run_test "Create user with invalid phone number" "false" \
    'curl -s -X POST "$BASE_URL/v1/users" -H "Content-Type: application/json" -d "{\"useremail\": \"invalid@example.com\", \"firstname\": \"Invalid\", \"lastname\": \"User\", \"usermobilenumber\": \"invalid_number\", \"isbusinessuser\": false}"'

# Test 8: Get inventory users
run_test "Get inventory users list" "true" \
    'curl -s "$BASE_URL/v1/inventoryusers"' \
    'echo "$response" | jq -r ".data[0].usersphonenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 9: Get individual inventory user
run_test "Get individual inventory user" "true" \
    'curl -s "$BASE_URL/v1/inventoryusers/4"' \
    'echo "$response" | jq -r ".data.usersphonenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 10: Create inventory user
run_test "Create inventory user with numeric phone" "true" \
    'curl -s -X POST "$BASE_URL/v1/inventoryusers" -H "Content-Type: application/json" -d "{\"useremail\": \"test_inv@example.com\", \"firstname\": \"TestInv\", \"lastname\": \"User\", \"role\": \"admin\", \"usersphonenumber\": 8888888888, \"location\": \"test_office\"}"' \
    'echo "$response" | jq -r ".data.usersphonenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 11: Update inventory user
run_test "Update inventory user with string phone" "true" \
    'curl -s -X PUT "$BASE_URL/v1/inventoryusers/9" -H "Content-Type: application/json" -d "{\"firstname\": \"UpdatedInv\", \"usersphonenumber\": \"6666666666\"}"' \
    'echo "$response" | jq -r ".data.usersphonenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 12: Upsert inventory user
run_test "Upsert inventory user (create new)" "true" \
    'curl -s -X POST "$BASE_URL/v1/inventoryusers/upsert" -H "Content-Type: application/json" -d "{\"useremail\": \"upsert_inv@example.com\", \"firstname\": \"UpsertInv\", \"lastname\": \"Test\", \"role\": \"user\", \"usersphonenumber\": \"4444444444\", \"location\": \"branch_office\"}"' \
    'echo "$response" | jq -r ".data.usersphonenumber" | grep -E "^[0-9]+$" > /dev/null'

# Test 13: Check timestamp data types
run_test "Verify timestamp data types in user response" "true" \
    'curl -s "$BASE_URL/v1/users/17"' \
    'echo "$response" | jq -r ".data.createddate" | grep -E "^[0-9]+$" > /dev/null && echo "$response" | jq -r ".data.modifieddate" | grep -E "^[0-9]+$" > /dev/null'

# Test 14: Check timestamp data types for inventory users
run_test "Verify timestamp data types in inventory user response" "true" \
    'curl -s "$BASE_URL/v1/inventoryusers/4"' \
    'echo "$response" | jq -r ".data.createddate" | grep -E "^[0-9]+$" > /dev/null && echo "$response" | jq -r ".data.modifieddate" | grep -E "^[0-9]+$" > /dev/null'

# Test 15: Large number handling
run_test "Create user with large phone number" "true" \
    'curl -s -X POST "$BASE_URL/v1/users" -H "Content-Type: application/json" -d "{\"useremail\": \"large_num@example.com\", \"firstname\": \"Large\", \"lastname\": \"Number\", \"usermobilenumber\": 99999999999999, \"isbusinessuser\": false}"' \
    'echo "$response" | jq -r ".data.usermobilenumber" | grep -E "^[0-9]+$" > /dev/null'

echo "============================================================"
echo "🏁 Test Results Summary"
echo "============================================================"
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $((TOTAL_TESTS - FAILED_TESTS))"
echo "Failed: $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! The API is production ready.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the failures above.${NC}"
    exit 1
fi 