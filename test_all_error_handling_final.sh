#!/bin/bash

# Comprehensive Error Handling Test Script
# Tests all 6 route groups: suppliers, products, stocks, purchase orders, purchase requests, picklists

echo "🧪 COMPREHENSIVE ERROR HANDLING TEST"
echo "===================================="
echo ""

BASE_URL="http://localhost:3000/v1"

# Test function for invalid ID format
test_invalid_id() {
    local endpoint=$1
    local route_name=$2
    
    echo "🔍 Testing $route_name - Invalid ID format (abc):"
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/$endpoint/abc")
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    echo "   Status: $http_status"
    echo "   Response: $body"
    echo ""
}

# Test function for not found ID
test_not_found_id() {
    local endpoint=$1
    local route_name=$2
    
    echo "🔍 Testing $route_name - Not found ID (999):"
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/$endpoint/999")
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    echo "   Status: $http_status"
    echo "   Response: $body"
    echo ""
}

# Test function for PUT with invalid ID
test_put_invalid_id() {
    local endpoint=$1
    local route_name=$2
    local test_data=$3
    
    echo "🔍 Testing $route_name PUT - Invalid ID format (abc):"
    response=$(curl -s -X PUT -H "Content-Type: application/json" -d "$test_data" -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/$endpoint/abc")
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    echo "   Status: $http_status"
    echo "   Response: $body"
    echo ""
}

# Test function for DELETE with invalid ID
test_delete_invalid_id() {
    local endpoint=$1
    local route_name=$2
    
    echo "🔍 Testing $route_name DELETE - Invalid ID format (abc):"
    response=$(curl -s -X DELETE -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/$endpoint/abc")
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    echo "   Status: $http_status"
    echo "   Response: $body"
    echo ""
}

echo "🏪 TESTING SUPPLIERS"
echo "==================="
test_invalid_id "suppliers" "Suppliers GET"
test_not_found_id "suppliers" "Suppliers GET"
test_put_invalid_id "suppliers" "Suppliers" '{"suppliercode":"TEST123","suppliername":"Test Supplier"}'
test_delete_invalid_id "suppliers" "Suppliers"

echo "📦 TESTING PRODUCTS"
echo "=================="
test_invalid_id "products" "Products GET"
test_not_found_id "products" "Products GET"
test_put_invalid_id "products" "Products" '{"productcode":"TEST123","productname":"Test Product"}'
test_delete_invalid_id "products" "Products"

echo "📊 TESTING STOCKS"
echo "================"
test_invalid_id "stocks" "Stocks GET"
test_not_found_id "stocks" "Stocks GET"
test_put_invalid_id "stocks" "Stocks" '{"quantity":100,"location":"Test Location"}'
test_delete_invalid_id "stocks" "Stocks"

echo "🛒 TESTING PURCHASE ORDERS"
echo "=========================="
test_invalid_id "purchaseorders" "Purchase Orders GET"
test_not_found_id "purchaseorders" "Purchase Orders GET"
test_put_invalid_id "purchaseorders" "Purchase Orders" '{"status":"pending","notes":"Test update"}'
test_delete_invalid_id "purchaseorders" "Purchase Orders"

echo "📝 TESTING PURCHASE REQUESTS"
echo "============================"
test_invalid_id "purchaserequests" "Purchase Requests GET"
test_not_found_id "purchaserequests" "Purchase Requests GET"
test_put_invalid_id "purchaserequests" "Purchase Requests" '{"status":"pending","notes":"Test update"}'
test_delete_invalid_id "purchaserequests" "Purchase Requests"

echo "📋 TESTING PICKLISTS"
echo "==================="
test_invalid_id "picklists" "Picklists GET"
test_not_found_id "picklists" "Picklists GET"
test_put_invalid_id "picklists" "Picklists" '{"label":"Test Label","value":"test_value"}'
test_delete_invalid_id "picklists" "Picklists"

echo "✅ COMPREHENSIVE TEST COMPLETED!"
echo ""
echo "Expected Results:"
echo "- All invalid ID tests (abc) should return 400 status"
echo "- All not found tests (999) should return 404 status"
echo "- All responses should have consistent format with success, message, details, statusCode"
echo "- No incomplete responses like {\"success\":false} only" 