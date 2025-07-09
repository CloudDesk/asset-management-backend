#!/bin/bash

# =================================================================
# ADVANCED PROMOTION ROUTES TESTING SCRIPT - PART 2
# Testing Promotion Rules, Target Links, Usage Logs, and Assets
# =================================================================

# Source configuration from main script
BASE_URL="http://localhost:5600/v1"
CONTENT_TYPE="Content-Type: application/json"
LOG_FILE="promotion_advanced_test_results.log"

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
echo "Advanced Promotion Routes Testing - $(date)" > "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

# Setup test data
PROMOTION_ID=1
RULE_ID=1
ACTION_ID=1
TARGET_LINK_ID=1
USAGE_LOG_ID=1
ASSET_ID=1

# =================================================================
# 3. PROMOTION RULES TESTING (/v1/promotion-rules)
# =================================================================

echo -e "\n${BLUE}=== TESTING PROMOTION RULES MODULE ===${NC}"

# 3.1 GET All Promotion Rules
run_test "Get all promotion rules" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-rules'"

# 3.2 POST Create User Rule
run_test "Create user promotion rule" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"rule_type\": \"user\",
    \"condition_key\": \"user_type\",
    \"operator\": \"equals\",
    \"value\": \"premium\",
    \"value_type\": \"string\",
    \"logic_group\": \"user_conditions\",
    \"priority\": 1,
    \"exclude\": false,
    \"is_active\": true,
    \"notes\": \"Rule for premium users\"
}' '$BASE_URL/promotion-rules'"

# 3.3 POST Create Product Rule
run_test "Create product promotion rule" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"rule_type\": \"product\",
    \"condition_key\": \"category\",
    \"operator\": \"in\",
    \"value\": \"electronics,gadgets\",
    \"value_type\": \"string\",
    \"logic_group\": \"product_conditions\",
    \"priority\": 2
}' '$BASE_URL/promotion-rules'"

# 3.4 POST Create Cart Rule
run_test "Create cart promotion rule" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"rule_type\": \"cart\",
    \"condition_key\": \"total_amount\",
    \"operator\": \"greater_than\",
    \"value\": \"100\",
    \"value_type\": \"currency\",
    \"logic_group\": \"cart_conditions\"
}' '$BASE_URL/promotion-rules'"

# 3.5 POST Create Payment Rule
run_test "Create payment promotion rule" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"rule_type\": \"payment\",
    \"condition_key\": \"payment_method\",
    \"operator\": \"equals\",
    \"value\": \"credit_card\",
    \"value_type\": \"string\"
}' '$BASE_URL/promotion-rules'"

# 3.6 POST Create Rule - Invalid Type
run_test "Create rule with invalid type" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"rule_type\": \"invalid_type\",
    \"condition_key\": \"test\"
}' '$BASE_URL/promotion-rules'"

# 3.7 GET Promotion Rules with Filters
run_test "Get rules with filters" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-rules?rule_type=user&is_active=true&exclude=false'"

# 3.8 GET Single Promotion Rule
run_test "Get promotion rule by ID" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-rules/$RULE_ID'"

# 3.9 PUT Update Promotion Rule
run_test "Update promotion rule" "200" "curl -s -X PUT -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"value\": \"gold,premium\",
    \"notes\": \"Updated rule for gold and premium users\"
}' '$BASE_URL/promotion-rules/$RULE_ID'"

# 3.10 POST Upsert Promotion Rule
run_test "Upsert promotion rule" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"rule_type\": \"user\",
    \"condition_key\": \"registration_date\",
    \"operator\": \"after\",
    \"value\": \"2024-01-01\",
    \"value_type\": \"string\"
}' '$BASE_URL/promotion-rules/upsert'"

# 3.11 DELETE Promotion Rule
run_test "Delete promotion rule" "200" "curl -s -X DELETE -w '\n%{http_code}' '$BASE_URL/promotion-rules/$RULE_ID'"

# =================================================================
# 4. PROMOTION TARGET LINKS TESTING (/v1/promotion-target-link)
# =================================================================

echo -e "\n${BLUE}=== TESTING PROMOTION TARGET LINKS MODULE ===${NC}"

# 4.1 GET All Promotion Target Links
run_test "Get all promotion target links" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-target-link'"

# 4.2 POST Create Product Target Link
run_test "Create product target link" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"target_type\": \"product\",
    \"target_id\": \"123\",
    \"target_label\": \"iPhone 15\",
    \"apply_scope\": \"include\",
    \"is_active\": true
}' '$BASE_URL/promotion-target-link'"

# 4.3 POST Create Category Target Link
run_test "Create category target link" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"target_type\": \"category\",
    \"target_id\": \"electronics\",
    \"target_label\": \"Electronics Category\",
    \"apply_scope\": \"include\"
}' '$BASE_URL/promotion-target-link'"

# 4.4 POST Create Brand Target Link
run_test "Create brand target link" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"target_type\": \"brand\",
    \"target_id\": \"apple\",
    \"target_label\": \"Apple Brand\",
    \"apply_scope\": \"exclude\"
}' '$BASE_URL/promotion-target-link'"

# 4.5 GET Target Links with Filters
run_test "Get target links with filters" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-target-link?target_type=product&apply_scope=include&is_active=true'"

# 4.6 GET Single Target Link
run_test "Get target link by ID" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-target-link/$TARGET_LINK_ID'"

# 4.7 PUT Update Target Link
run_test "Update target link" "200" "curl -s -X PUT -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"target_label\": \"Updated iPhone 15 Pro\",
    \"is_active\": false
}' '$BASE_URL/promotion-target-link/$TARGET_LINK_ID'"

# 4.8 POST Upsert Target Link
run_test "Upsert target link" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"target_type\": \"user_segment\",
    \"target_id\": \"vip_customers\",
    \"target_label\": \"VIP Customers\",
    \"apply_scope\": \"include\"
}' '$BASE_URL/promotion-target-link/upsert'"

# 4.9 DELETE Target Link
run_test "Delete target link" "200" "curl -s -X DELETE -w '\n%{http_code}' '$BASE_URL/promotion-target-link/$TARGET_LINK_ID'"

# =================================================================
# 5. PROMOTION USAGE LOGS TESTING (/v1/promotion-usage-log)
# =================================================================

echo -e "\n${BLUE}=== TESTING PROMOTION USAGE LOGS MODULE ===${NC}"

# 5.1 GET All Usage Logs
run_test "Get all promotion usage logs" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-usage-log'"

# 5.2 POST Create Usage Log
run_test "Create promotion usage log" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"user_id\": \"user123\",
    \"order_id\": \"order456\",
    \"redemption_date\": \"2024-01-15T10:30:00Z\",
    \"discount_applied\": 15.50,
    \"platform\": \"web\"
}' '$BASE_URL/promotion-usage-log'"

# 5.3 POST Create Mobile Usage Log
run_test "Create mobile usage log" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"user_id\": \"user789\",
    \"order_id\": \"order123\",
    \"redemption_date\": \"2024-01-15T14:45:00Z\",
    \"discount_applied\": 25.00,
    \"platform\": \"mobile\"
}' '$BASE_URL/promotion-usage-log'"

# 5.4 GET Usage Logs with Filters
run_test "Get usage logs with filters" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-usage-log?user_id=user123&platform=web'"

# 5.5 GET Single Usage Log
run_test "Get usage log by ID" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotion-usage-log/$USAGE_LOG_ID'"

# 5.6 PUT Update Usage Log
run_test "Update usage log" "200" "curl -s -X PUT -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"discount_applied\": 20.00
}' '$BASE_URL/promotion-usage-log/$USAGE_LOG_ID'"

# 5.7 POST Upsert Usage Log
run_test "Upsert usage log" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"promotion_id\": $PROMOTION_ID,
    \"user_id\": \"user999\",
    \"order_id\": \"order999\",
    \"redemption_date\": \"2024-01-20T09:00:00Z\",
    \"discount_applied\": 30.00,
    \"platform\": \"app\"
}' '$BASE_URL/promotion-usage-log/upsert'"

# 5.8 DELETE Usage Log
run_test "Delete usage log" "200" "curl -s -X DELETE -w '\n%{http_code}' '$BASE_URL/promotion-usage-log/$USAGE_LOG_ID'"

# =================================================================
# 6. PROMOTIONAL ASSETS TESTING (/v1/promotional-assets)
# =================================================================

echo -e "\n${BLUE}=== TESTING PROMOTIONAL ASSETS MODULE ===${NC}"

# 6.1 GET All Promotional Assets
run_test "Get all promotional assets" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets'"

# 6.2 POST Create Banner Asset
run_test "Create banner promotional asset" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"type\": \"banner\",
    \"placement\": \"homepage_top\",
    \"title\": \"New Year Sale Banner\",
    \"content\": {
        \"images\": [\"banner1.jpg\", \"banner2.jpg\"],
        \"text\": \"Save 50% on all electronics!\",
        \"cta_text\": \"Shop Now\",
        \"cta_url\": \"/sale\"
    },
    \"priority\": 10,
    \"is_active\": true,
    \"schedule_start\": \"2024-01-01T00:00:00Z\",
    \"schedule_end\": \"2024-01-31T23:59:59Z\"
}' '$BASE_URL/promotional-assets'"

# 6.3 POST Create Popup Asset
run_test "Create popup promotional asset" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"type\": \"popup\",
    \"placement\": \"exit_intent\",
    \"title\": \"Dont Leave Empty Handed\",
    \"content\": {
        \"text\": \"Get 10% off your first order\",
        \"discount_code\": \"WELCOME10\",
        \"expiry\": \"Limited time offer\"
    },
    \"priority\": 5
}' '$BASE_URL/promotional-assets'"

# 6.4 POST Create Carousel Asset
run_test "Create carousel promotional asset" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"type\": \"carousel\",
    \"placement\": \"homepage_middle\",
    \"title\": \"Featured Products Carousel\",
    \"content\": {
        \"slides\": [
            {\"image\": \"slide1.jpg\", \"title\": \"Product 1\", \"price\": \"$99\"},
            {\"image\": \"slide2.jpg\", \"title\": \"Product 2\", \"price\": \"$149\"},
            {\"image\": \"slide3.jpg\", \"title\": \"Product 3\", \"price\": \"$199\"}
        ]
    },
    \"priority\": 8
}' '$BASE_URL/promotional-assets'"

# 6.5 POST Create Featured Ad Asset
run_test "Create featured ad asset" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"type\": \"featured_ad\",
    \"placement\": \"sidebar\",
    \"title\": \"Premium Membership Ad\",
    \"content\": {
        \"image\": \"premium_ad.jpg\",
        \"heading\": \"Go Premium Today\",
        \"description\": \"Unlock exclusive benefits and discounts\",
        \"cta_text\": \"Upgrade Now\"
    }
}' '$BASE_URL/promotional-assets'"

# 6.6 POST Create Asset - Invalid Type
run_test "Create asset with invalid type" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"type\": \"invalid_type\",
    \"placement\": \"test\",
    \"title\": \"Test\"
}' '$BASE_URL/promotional-assets'"

# 6.7 POST Create Asset - Missing Required Fields
run_test "Create asset missing required fields" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"type\": \"banner\"
}' '$BASE_URL/promotional-assets'"

# 6.8 GET Assets with Type Filter
run_test "Get assets with type filter" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets?type=banner'"

# 6.9 GET Assets with Multiple Type Filter
run_test "Get assets with multiple types" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets?type=banner,popup'"

# 6.10 GET Assets with Placement Filter
run_test "Get assets with placement filter" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets?placement=homepage_top'"

# 6.11 GET Assets with Active Status Filter
run_test "Get active assets" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets?is_active=true'"

# 6.12 GET Assets with Schedule Filter
run_test "Get currently scheduled assets" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets?schedule_active=true'"

# 6.13 GET Assets with Priority Range
run_test "Get assets with priority range" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets?priority_min=5&priority_max=15'"

# 6.14 GET Assets with Title Search
run_test "Get assets with title search" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets?title=sale'"

# 6.15 GET Single Asset
run_test "Get promotional asset by ID" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets/$ASSET_ID'"

# 6.16 PUT Update Asset
run_test "Update promotional asset" "200" "curl -s -X PUT -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"title\": \"Updated New Year Sale Banner\",
    \"priority\": 15,
    \"content\": {
        \"images\": [\"updated_banner1.jpg\", \"updated_banner2.jpg\"],
        \"text\": \"Save up to 70% on all electronics!\",
        \"cta_text\": \"Shop Now\",
        \"cta_url\": \"/mega-sale\"
    }
}' '$BASE_URL/promotional-assets/$ASSET_ID'"

# 6.17 POST Upsert Asset - Create
run_test "Upsert asset (create)" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"type\": \"banner\",
    \"placement\": \"category_page\",
    \"title\": \"Category Sale Banner\",
    \"content\": {
        \"text\": \"Special category discounts\"
    }
}' '$BASE_URL/promotional-assets/upsert'"

# 6.18 POST Upsert Asset - Update
run_test "Upsert asset (update)" "200" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"id\": $ASSET_ID,
    \"title\": \"Upserted Banner Title\",
    \"is_active\": false
}' '$BASE_URL/promotional-assets/upsert'"

# 6.19 DELETE Image from Asset
run_test "Delete image from asset" "200" "curl -s -X DELETE -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"imageUrl\": \"banner1.jpg\"
}' '$BASE_URL/promotional-assets/$ASSET_ID/images'"

# 6.20 GET Audit Logs for Asset
run_test "Get asset audit logs" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets/$ASSET_ID/audit-logs'"

# 6.21 DELETE Asset
run_test "Delete promotional asset" "200" "curl -s -X DELETE -w '\n%{http_code}' '$BASE_URL/promotional-assets/$ASSET_ID'"

echo -e "\n${YELLOW}Advanced Tests Summary:${NC}"
echo -e "${YELLOW}Total Tests: $TOTAL_TESTS${NC}"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo -e "\nAdvanced results logged to: $LOG_FILE" 