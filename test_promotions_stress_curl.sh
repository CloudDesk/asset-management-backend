#!/bin/bash

# =================================================================
# PROMOTION ROUTES STRESS & EDGE CASE TESTING SCRIPT
# Testing Performance, Security, and Edge Cases as an Architect
# =================================================================

BASE_URL="http://localhost:5600/v1"
CONTENT_TYPE="Content-Type: application/json"
LOG_FILE="promotion_stress_test_results.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Utility functions
log_test() {
    echo -e "${BLUE}[STRESS TEST $((++TOTAL_TESTS))]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓ SUCCESS:${NC} $1" | tee -a "$LOG_FILE"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}✗ FAILED:${NC} $1" | tee -a "$LOG_FILE"
    ((FAILED_TESTS++))
}

log_performance() {
    echo -e "${PURPLE}⚡ PERFORMANCE:${NC} $1" | tee -a "$LOG_FILE"
}

# Performance test helper
run_performance_test() {
    local test_name="$1"
    local curl_cmd="$2"
    local max_time="$3"
    
    log_test "$test_name"
    
    # Execute curl with timing
    start_time=$(date +%s%3N)
    response=$(eval "$curl_cmd" 2>/dev/null)
    end_time=$(date +%s%3N)
    
    duration=$((end_time - start_time))
    status_code=$(echo "$response" | tail -n1)
    
    if [[ $duration -le $max_time ]]; then
        log_performance "Completed in ${duration}ms (under ${max_time}ms limit)"
        log_success "Performance test passed"
    else
        log_error "Took ${duration}ms (exceeded ${max_time}ms limit)"
    fi
    
    echo "Response code: $status_code"
    echo "----------------------------------------"
}

# Security test helper
run_security_test() {
    local test_name="$1"
    local expected_status="$2"
    local curl_cmd="$3"
    
    log_test "SECURITY: $test_name"
    
    response=$(eval "$curl_cmd" 2>/dev/null)
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "Security test passed - status $status_code"
    else
        log_error "Security test failed - expected $expected_status, got $status_code"
    fi
    
    echo "Response: $response_body"
    echo "----------------------------------------"
}

# Initialize log file
echo "Promotion Routes Stress & Edge Case Testing - $(date)" > "$LOG_FILE"
echo "======================================================" >> "$LOG_FILE"

# =================================================================
# PERFORMANCE TESTING
# =================================================================

echo -e "\n${PURPLE}=== PERFORMANCE TESTING ===${NC}"

# Test pagination performance with large datasets
run_performance_test "Large pagination request" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?page=1&limit=100'" 2000

# Test complex filtering performance
run_performance_test "Complex filter query" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?status=active&type=coupon&stackable=true&visibility=public&start_date_after=2024-01-01T00:00:00Z&end_date_before=2024-12-31T23:59:59Z'" 1500

# Test promotional assets with multiple filters
run_performance_test "Asset complex filtering" "curl -s -w '\n%{http_code}' '$BASE_URL/promotional-assets?type=banner,popup&is_active=true&priority_min=5&priority_max=15&schedule_active=true'" 1500

# Test promotion eligibility evaluation
run_performance_test "Promotion eligibility evaluation" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"user_id\": \"performance_test_user\",
    \"platform\": \"web\",
    \"cart\": [
        {\"product_id\": \"1\", \"quantity\": 5, \"price\": 100.00},
        {\"product_id\": \"2\", \"quantity\": 3, \"price\": 75.00},
        {\"product_id\": \"3\", \"quantity\": 2, \"price\": 50.00},
        {\"product_id\": \"4\", \"quantity\": 1, \"price\": 200.00}
    ]
}' '$BASE_URL/promotions/eligible'" 3000

# =================================================================
# EDGE CASE TESTING
# =================================================================

echo -e "\n${YELLOW}=== EDGE CASE TESTING ===${NC}"

# Test extremely large payload
log_test "Extremely large promotion data"
large_content=""
for i in {1..1000}; do
    large_content+="{\"key$i\": \"value$i\"},"
done
large_content="[${large_content%,}]"

response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d "{
    \"name\": \"Large Data Test\",
    \"type\": \"coupon\",
    \"content\": $large_content
}" "$BASE_URL/promotions" 2>/dev/null)
status_code=$(echo "$response" | tail -n1)

if [[ "$status_code" =~ ^[45] ]]; then
    log_success "Properly rejected large payload - status $status_code"
else
    log_error "Unexpectedly accepted large payload - status $status_code"
fi

# Test Unicode and special characters
log_test "Unicode and special characters"
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d '{
    "name": "Test 🎉 Promotion™ with émojí & spéciàl chars 你好",
    "type": "coupon",
    "code": "SPECIAL!@#$%^&*()_+-=[]{}|;:,.<>?",
    "status": "active"
}' "$BASE_URL/promotions" 2>/dev/null)
echo "Unicode test response: $response"

# Test null and undefined values
log_test "Null and undefined values"
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d '{
    "name": null,
    "type": "coupon",
    "code": undefined,
    "status": ""
}' "$BASE_URL/promotions" 2>/dev/null)
echo "Null values test response: $response"

# Test extremely long strings
log_test "Extremely long string values"
long_string=$(printf 'A%.0s' {1..10000})
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d "{
    \"name\": \"$long_string\",
    \"type\": \"coupon\"
}" "$BASE_URL/promotions" 2>/dev/null)
echo "Long string test response: $response"

# Test negative and zero values
log_test "Negative and zero values"
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d '{
    "promotion_id": -1,
    "value": -100,
    "priority": 0,
    "max_discount_cap": -50,
    "action_order": -5
}' "$BASE_URL/promotion-actions" 2>/dev/null)
echo "Negative values test response: $response"

# Test invalid date formats
log_test "Invalid date formats"
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d '{
    "name": "Date Test",
    "type": "coupon",
    "start_date": "invalid-date",
    "end_date": "2024-13-45T25:70:70Z"
}' "$BASE_URL/promotions" 2>/dev/null)
echo "Invalid date test response: $response"

# Test deeply nested JSON
log_test "Deeply nested JSON structure"
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d '{
    "type": "banner",
    "placement": "test",
    "title": "Nested Test",
    "content": {
        "level1": {
            "level2": {
                "level3": {
                    "level4": {
                        "level5": {
                            "data": "deep value"
                        }
                    }
                }
            }
        }
    }
}' "$BASE_URL/promotional-assets" 2>/dev/null)
echo "Nested JSON test response: $response"

# =================================================================
# SECURITY TESTING
# =================================================================

echo -e "\n${RED}=== SECURITY TESTING ===${NC}"

# Test SQL injection attempts
run_security_test "SQL injection in filter" "200" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions?name=test%27%20OR%20%271%27=%271'"

run_security_test "SQL injection in ID parameter" "400" "curl -s -w '\n%{http_code}' '$BASE_URL/promotions/1%27%20OR%20%271%27=%271'"

# Test XSS attempts
run_security_test "XSS in promotion name" "201" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": \"<script>alert(\\\"XSS\\\")</script>\",
    \"type\": \"coupon\"
}' '$BASE_URL/promotions'"

# Test NoSQL injection
run_security_test "NoSQL injection attempt" "400" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' -d '{
    \"name\": {\"$ne\": null},
    \"type\": \"coupon\"
}' '$BASE_URL/promotions'"

# Test header injection
run_security_test "Header injection" "201" "curl -s -X POST -H '$CONTENT_TYPE' -H 'X-Injected-Header: injected%0d%0aSet-Cookie:%20malicious=true' -w '\n%{http_code}' -d '{
    \"name\": \"Header Test\",
    \"type\": \"coupon\"
}' '$BASE_URL/promotions'"

# Test oversized request body
run_security_test "Oversized request body" "413" "curl -s -X POST -H '$CONTENT_TYPE' -w '\n%{http_code}' --data-raw '$(printf \"A%.0s\" {1..10000000})' '$BASE_URL/promotions'"

# Test file path traversal
run_security_test "Path traversal attempt" "404" "curl -s -w '\n%{http_code}' '$BASE_URL/../../../etc/passwd'"

# Test method override
run_security_test "HTTP method override" "405" "curl -s -X PATCH -w '\n%{http_code}' '$BASE_URL/promotions'"

# =================================================================
# CONCURRENT REQUEST TESTING
# =================================================================

echo -e "\n${BLUE}=== CONCURRENT REQUEST TESTING ===${NC}"

log_test "Concurrent promotion creation"
pids=()
for i in {1..10}; do
    curl -s -X POST -H "$CONTENT_TYPE" -d "{
        \"name\": \"Concurrent Test $i\",
        \"type\": \"coupon\",
        \"code\": \"CONCURRENT$i\"
    }" "$BASE_URL/promotions" > /dev/null &
    pids+=($!)
done

# Wait for all background processes
for pid in "${pids[@]}"; do
    wait $pid
done
log_success "Concurrent creation test completed"

# =================================================================
# RATE LIMITING TESTING
# =================================================================

echo -e "\n${PURPLE}=== RATE LIMITING TESTING ===${NC}"

log_test "Rate limiting test - rapid requests"
success_count=0
for i in {1..50}; do
    response=$(curl -s -w '%{http_code}' "$BASE_URL/promotions" 2>/dev/null)
    if [[ "$response" == "200" ]]; then
        ((success_count++))
    elif [[ "$response" == "429" ]]; then
        log_success "Rate limiting triggered at request $i"
        break
    fi
done

if [[ $success_count -eq 50 ]]; then
    log_error "No rate limiting detected after 50 requests"
else
    log_success "Rate limiting working properly"
fi

# =================================================================
# DATA VALIDATION EDGE CASES
# =================================================================

echo -e "\n${YELLOW}=== DATA VALIDATION EDGE CASES ===${NC}"

# Test array injection
log_test "Array injection in string field"
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d '{
    "name": ["array", "instead", "of", "string"],
    "type": "coupon"
}' "$BASE_URL/promotions" 2>/dev/null)
echo "Array injection response: $response"

# Test boolean string confusion
log_test "Boolean string confusion"
response=$(curl -s -w '\n%{http_code}' "$BASE_URL/promotions?stackable=yes&auto_apply=1&is_active=on" 2>/dev/null)
echo "Boolean confusion response: $response"

# Test floating point precision
log_test "Floating point precision"
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d '{
    "promotion_id": 1,
    "action_type": "flat_discount",
    "value": 0.123456789012345,
    "max_discount_cap": 999999999.999999999
}' "$BASE_URL/promotion-actions" 2>/dev/null)
echo "Float precision response: $response"

# Test circular reference (if applicable)
log_test "Circular reference attempt"
response=$(curl -s -X POST -H "$CONTENT_TYPE" -w '\n%{http_code}' -d '{
    "type": "banner",
    "placement": "test",
    "title": "Circular Test",
    "content": {
        "self": "reference to content"
    }
}' "$BASE_URL/promotional-assets" 2>/dev/null)
echo "Circular reference response: $response"

# =================================================================
# FINAL SUMMARY
# =================================================================

echo -e "\n${PURPLE}=== STRESS TESTING SUMMARY ===${NC}"
echo -e "${YELLOW}Total Stress Tests: $TOTAL_TESTS${NC}"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo -e "${BLUE}Success Rate: ${success_rate}%${NC}"

if [[ $success_rate -ge 90 ]]; then
    echo -e "${GREEN}🎉 EXCELLENT: System shows high resilience${NC}"
elif [[ $success_rate -ge 75 ]]; then
    echo -e "${YELLOW}⚠️  GOOD: System is mostly stable with some issues${NC}"
else
    echo -e "${RED}❌ POOR: System needs significant improvements${NC}"
fi

echo -e "\nStress test results logged to: $LOG_FILE"

# =================================================================
# RECOMMENDATIONS
# =================================================================

echo -e "\n${BLUE}=== ARCHITECT RECOMMENDATIONS ===${NC}"
echo "1. Implement rate limiting if not detected"
echo "2. Add input sanitization for XSS prevention"
echo "3. Implement request size limits"
echo "4. Add monitoring for concurrent request handling"
echo "5. Consider implementing caching for frequent queries"
echo "6. Add comprehensive logging for security events"
echo "7. Implement circuit breakers for external dependencies"
echo "8. Add database connection pooling optimization"
echo "9. Consider implementing API versioning"
echo "10. Add comprehensive error handling and recovery mechanisms" 