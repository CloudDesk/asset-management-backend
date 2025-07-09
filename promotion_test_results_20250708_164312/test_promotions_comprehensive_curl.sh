#!/bin/bash

# =================================================================
# COMPREHENSIVE PROMOTION ROUTES TESTING SCRIPT
# Testing as an Architect - Maximum Coverage Scenarios
# =================================================================

# Configuration
BASE_URL="http://localhost:5600/v1"
CONTENT_TYPE="Content-Type: application/json"
LOG_FILE="promotion_test_results.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Utility functions
log_test() {
    echo -e "${BLUE}[TEST $((++TOTAL_TESTS))]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓ SUCCESS:${NC} $1" | tee -a "$LOG_FILE"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}✗ FAILED:${NC} $1" | tee -a "$LOG_FILE"
    ((FAILED_TESTS++))
}

log_info() {
    echo -e "${YELLOW}ℹ INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Test helper function
run_test() {
    local test_name="$1"
    local expected_status="$2"
    local curl_cmd="$3"
    
    log_test "$test_name"
    
    # Execute curl and capture response
    response=$(eval "$curl_cmd" 2>/dev/null)
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    # Check status code
    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "Expected status $expected_status, got $status_code"
        echo "Response: $response_body" | jq '.' 2>/dev/null || echo "Response: $response_body"
    else
        log_error "Expected status $expected_status, got $status_code"
        echo "Response: $response_body"
    fi
    
    echo "----------------------------------------"
}

# Initialize log file
echo "Promotion Routes Comprehensive Testing - $(date)" > "$LOG_FILE"
echo "=========================================" >> "$LOG_FILE"

# =================================================================
# 1. PROMOTIONS TESTING (/v1/promotions)
# =================================================================

echo -e "\n${BLUE}=== TESTING PROMOTIONS MODULE ===${NC}"

# 1.1 GET All Promotions - Basic
run_test "Get all promotions (basic)" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions'"

# 1.2 GET All Promotions - With Pagination
run_test "Get promotions with pagination" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?page=1&limit=5'"

# 1.3 GET All Promotions - With Filters
run_test "Get promotions with filters" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?status=active&type=coupon'"

# 1.4 GET All Promotions - Complex Filters
run_test "Get promotions with complex filters" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?status=active&stackable=true&priority=1&visibility=public'"

# 1.5 GET All Promotions - Date Range Filters
run_test "Get promotions with date filters" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?start_date_after=2024-01-01T00:00:00Z&end_date_before=2024-12-31T23:59:59Z'"

# 1.6 POST Create Promotion - Valid Data
run_test "Create promotion with valid data" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"Test Promotion 1\",
    \"type\": \"coupon\",
    \"code\": \"TEST2024\",
    \"status\": \"active\",
    \"priority\": 1,
    \"visibility\": \"public\",
    \"stackable\": true,
    \"auto_apply\": false,
    \"max_redemptions\": 100,
    \"per_user_limit\": 1,
    \"start_date\": \"2024-01-01T00:00:00Z\",
    \"end_date\": \"2024-12-31T23:59:59Z\"
}' '$BASE_URL/promotions'"

# Store promotion ID for further tests
PROMOTION_ID=1

# 1.7 POST Create Promotion - Minimal Data
run_test "Create promotion with minimal data" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"Minimal Promotion\"
}' '$BASE_URL/promotions'"

# 1.8 POST Create Promotion - Invalid Data (Empty name)
run_test "Create promotion with invalid data" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"\",
    \"type\": \"invalid_type\"
}' '$BASE_URL/promotions'"

# 1.9 POST Create Promotion - Invalid Type
run_test "Create promotion with invalid type" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"Test Invalid\",
    \"type\": \"invalid_type\"
}' '$BASE_URL/promotions'"

# 1.10 POST Create Promotion - Invalid JSON
run_test "Create promotion with malformed JSON" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"Test\",
    \"type\": \"coupon\",
}' '$BASE_URL/promotions'"

# 1.11 GET Single Promotion - Valid ID
run_test "Get promotion by valid ID" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions/$PROMOTION_ID'"

# 1.12 GET Single Promotion - Invalid ID (Non-numeric)
run_test "Get promotion by invalid ID" "400" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions/abc'"

# 1.13 GET Single Promotion - Non-existent ID
run_test "Get promotion by non-existent ID" "404" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions/99999'"

# 1.14 PUT Update Promotion - Valid Data
run_test "Update promotion with valid data" "200" "curl -s -X PUT -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"Updated Test Promotion\",
    \"status\": \"inactive\",
    \"priority\": 5
}' '$BASE_URL/promotions/$PROMOTION_ID'"

# 1.15 PUT Update Promotion - Invalid ID
run_test "Update promotion with invalid ID" "400" "curl -s -X PUT -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"Updated\"
}' '$BASE_URL/promotions/invalid'"

# 1.16 PUT Update Promotion - Non-existent ID
run_test "Update promotion with non-existent ID" "404" "curl -s -X PUT -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"Updated\"
}' '$BASE_URL/promotions/99999'"

# 1.17 POST Upsert Promotion - Create (no ID)
run_test "Upsert promotion (create)" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"Upserted Promotion\",
    \"type\": \"automatic\",
    \"status\": \"active\"
}' '$BASE_URL/promotions/upsert'"

# 1.18 POST Upsert Promotion - Update (with ID)
run_test "Upsert promotion (update)" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"id\": $PROMOTION_ID,
    \"name\": \"Upserted Updated Promotion\",
    \"type\": \"waive_fee\"
}' '$BASE_URL/promotions/upsert'"

# 1.19 GET Promotion Eligibility - Valid Query
run_test "Get promotion eligibility (GET)" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions/eligible?user_id=user123&platform=web'"

# 1.20 GET Promotion Eligibility - With Code
run_test "Get promotion eligibility with code" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions/eligible?user_id=user123&platform=mobile&code=TEST2024'"

# 1.21 GET Promotion Eligibility - Missing Required Params
run_test "Get promotion eligibility missing params" "400" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions/eligible?user_id=user123'"

# 1.22 POST Promotion Eligibility - Valid Data
run_test "Post promotion eligibility evaluation" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"user_id\": \"user123\",
    \"platform\": \"web\",
    \"cart\": [
        {\"product_id\": \"1\", \"quantity\": 2, \"price\": 50.00},
        {\"product_id\": \"2\", \"quantity\": 1, \"price\": 25.00}
    ]
}' '$BASE_URL/promotions/eligible'"

# 1.23 POST Promotion Eligibility - With Code
run_test "Post promotion eligibility with code" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"user_id\": \"user123\",
    \"platform\": \"mobile\",
    \"code\": \"TEST2024\",
    \"cart\": [
        {\"product_id\": \"1\", \"quantity\": 1, \"price\": 100.00}
    ]
}' '$BASE_URL/promotions/eligible'"

# 1.24 POST Promotion Eligibility - Invalid Cart Data
run_test "Post promotion eligibility invalid cart" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"user_id\": \"user123\",
    \"platform\": \"web\",
    \"cart\": [
        {\"product_id\": \"1\", \"quantity\": \"invalid\"}
    ]
}' '$BASE_URL/promotions/eligible'"

# 1.25 DELETE Promotion - Valid ID
run_test "Delete promotion with valid ID" "200" "curl -s -X DELETE -w '\n%{http_code}' '$BASE_URL/promotions/$PROMOTION_ID'"

# 1.26 DELETE Promotion - Invalid ID
run_test "Delete promotion with invalid ID" "400" "curl -s -X DELETE -w '\n%{http_code}' '$BASE_URL/promotions/invalid'"

# 1.27 DELETE Promotion - Non-existent ID
run_test "Delete promotion with non-existent ID" "404" "curl -s -X DELETE -w '\n%{http_code}' '$BASE_URL/promotions/99999'"

# 1.28 Edge Cases - Large Pagination
run_test "Get promotions with large page number" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?page=999&limit=100'"

# 1.29 Edge Cases - Invalid Pagination
run_test "Get promotions with invalid pagination" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?page=-1&limit=0'"

# 1.30 Edge Cases - Special Characters in Filters
run_test "Get promotions with special chars" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?name=Test%20%26%20Special%20%40%20Chars'"

# =================================================================
# 2. PROMOTION ACTIONS TESTING (/v1/promotion-actions)
# =================================================================

echo -e "\n${BLUE}=== TESTING PROMOTION ACTIONS MODULE ===${NC}"

# Create a promotion first for actions
curl -s -X POST -H "$CONTENT_TYPE" -d '{"name": "Action Test Promotion", "type": "coupon", "status": "active"}' "$BASE_URL/promotions" > /dev/null
ACTION_PROMOTION_ID=2

# 2.1 GET All Promotion Actions
run_test "Get all promotion actions" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-actions'"

# 2.2 POST Create Promotion Action - Valid Data
run_test "Create promotion action" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $ACTION_PROMOTION_ID,
    \"action_type\": \"percentage_discount\",
    \"target\": \"cart_total\",
    \"value_type\": \"percentage\",
    \"value\": 10,
    \"max_discount_cap\": 50.00,
    \"check_inventory\": true,
    \"execution_group\": \"primary\",
    \"action_order\": 1
}' '$BASE_URL/promotion-actions'"

ACTION_ID=1

# 2.3 POST Create Promotion Action - Flat Discount
run_test "Create flat discount action" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $ACTION_PROMOTION_ID,
    \"action_type\": \"flat_discount\",
    \"target\": \"product\",
    \"value_type\": \"currency\",
    \"value\": 5.00,
    \"apply_to_product_ids\": [1, 2, 3]
}' '$BASE_URL/promotion-actions'"

# 2.4 POST Create Promotion Action - Free Product
run_test "Create free product action" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $ACTION_PROMOTION_ID,
    \"action_type\": \"free_product\",
    \"target\": \"reward\",
    \"reward_product_id\": 100,
    \"min_combo_size\": 3,
    \"check_inventory\": true
}' '$BASE_URL/promotion-actions'"

# 2.5 POST Create Promotion Action - Invalid Type
run_test "Create action with invalid type" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $ACTION_PROMOTION_ID,
    \"action_type\": \"invalid_type\",
    \"target\": \"cart_total\"
}' '$BASE_URL/promotion-actions'"

# 2.6 GET Promotion Actions with Filters
run_test "Get actions with filters" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-actions?action_type=percentage_discount&check_inventory=true'"

# 2.7 GET Single Promotion Action
run_test "Get promotion action by ID" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-actions/$ACTION_ID'"

# 2.8 PUT Update Promotion Action
run_test "Update promotion action" "200" "curl -s -X PUT -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"value\": 15,
    \"max_discount_cap\": 75.00
}' '$BASE_URL/promotion-actions/$ACTION_ID'"

# 2.9 POST Upsert Promotion Action
run_test "Upsert promotion action" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $ACTION_PROMOTION_ID,
    \"action_type\": \"waive_fee\",
    \"target\": \"shipping\",
    \"value\": 0
}' '$BASE_URL/promotion-actions/upsert'"

# 2.10 DELETE Promotion Action
run_test "Delete promotion action" "200" "curl -s -X DELETE -w '\n%{http_code}' '$BASE_URL/promotion-actions/$ACTION_ID'"

echo -e "\n${YELLOW}Total Tests: $TOTAL_TESTS${NC}"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo -e "\nFull results logged to: $LOG_FILE" 