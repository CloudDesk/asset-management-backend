#!/bin/bash

# Authentication Route Testing Script
# This script tests public and protected routes to verify smart authentication

BASE_URL="http://localhost:5600"

echo "=================================="
echo "Authentication Route Testing"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test a route
test_route() {
    local method=$1
    local path=$2
    local should_be_public=$3
    local description=$4
    
    echo -n "Testing: $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -d '{}')
    fi
    
    if [ "$should_be_public" = "true" ]; then
        # Public route should NOT return 401
        if [ "$response" != "401" ]; then
            echo -e "${GREEN}✓ PASS${NC} (HTTP $response - Public route accessible)"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAIL${NC} (HTTP $response - Should be public but got 401)"
            ((FAILED++))
        fi
    else
        # Protected route SHOULD return 401 without token
        if [ "$response" = "401" ]; then
            echo -e "${GREEN}✓ PASS${NC} (HTTP $response - Protected route requires auth)"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAIL${NC} (HTTP $response - Should require auth but didn't)"
            ((FAILED++))
        fi
    fi
}

echo "=================================="
echo "E-COMMERCE PUBLIC ROUTES"
echo "=================================="
echo ""

test_route "POST" "/v1/mobile-auth/request-otp" "true" "Mobile Auth - Request OTP"
test_route "POST" "/v1/mobile-auth/verify-otp" "true" "Mobile Auth - Verify OTP"
test_route "GET" "/v1/products/platform/ecommerce" "true" "Products - Platform List"
test_route "GET" "/v1/products/platform/ecommerce/counts" "true" "Products - Platform Counts"
test_route "GET" "/v1/products/123/platform/ecommerce" "true" "Products - Single Product by Platform"
test_route "GET" "/v1/promotions/public" "true" "Promotions - Public"
test_route "GET" "/v1/promotions/active" "true" "Promotions - Active"
test_route "GET" "/v1/ratings/product/123" "true" "Ratings - By Product"
test_route "GET" "/v1/picklists?type=category" "true" "Picklists - Category"
test_route "GET" "/v1/health" "true" "Health Check"

echo ""
echo "=================================="
echo "INVENTORY PUBLIC ROUTES"
echo "=================================="
echo ""

test_route "POST" "/v1/auth/signin" "true" "Auth - Sign In"
test_route "POST" "/v1/auth/forgot-password" "true" "Auth - Forgot Password"
test_route "POST" "/v1/inventoryusers" "true" "Inventory Users - Create"
test_route "GET" "/v1/roles?limit=1000&isactive=true" "true" "Roles - List"

echo ""
echo "=================================="
echo "PROTECTED ROUTES (Should Require Auth)"
echo "=================================="
echo ""

test_route "GET" "/v1/products" "false" "Products - List (Protected)"
test_route "GET" "/v1/orders" "false" "Orders - List (Protected)"
test_route "GET" "/v1/carts" "false" "Carts - List (Protected)"
test_route "GET" "/v1/users" "false" "Users - List (Protected)"
test_route "GET" "/v1/stocks" "false" "Stocks - List (Protected)"
test_route "POST" "/v1/products" "false" "Products - Create (Protected)"

echo ""
echo "=================================="
echo "TEST SUMMARY"
echo "=================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
