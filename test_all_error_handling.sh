#!/bin/bash

echo "=== COMPREHENSIVE ERROR HANDLING TEST ==="
echo ""

BASE_URL="http://localhost:5600"

# Test function for GET endpoints with invalid IDs
test_get_invalid_id() {
    local endpoint=$1
    local resource_name=$2
    
    echo "Testing $resource_name GET with invalid ID (999):"
    response=$(curl -s -X GET "$BASE_URL$endpoint/999")
    echo "$response"
    echo ""
    
    echo "Testing $resource_name GET with invalid ID format (abc):"
    response=$(curl -s -X GET "$BASE_URL$endpoint/abc")
    echo "$response"
    echo ""
}

# Test function for PUT endpoints with invalid IDs
test_put_invalid_id() {
    local endpoint=$1
    local resource_name=$2
    
    echo "Testing $resource_name PUT with invalid ID (999):"
    response=$(curl -s -X PUT "$BASE_URL$endpoint/999" -H "Content-Type: application/json" -d '{"test": "data"}')
    echo "$response"
    echo ""
}

# Test function for DELETE endpoints with invalid IDs
test_delete_invalid_id() {
    local endpoint=$1
    local resource_name=$2
    
    echo "Testing $resource_name DELETE with invalid ID (999):"
    response=$(curl -s -X DELETE "$BASE_URL$endpoint/999")
    echo "$response"
    echo ""
}

echo "1. SUPPLIERS"
echo "============"
test_get_invalid_id "/v1/suppliers" "Supplier"
test_put_invalid_id "/v1/suppliers" "Supplier"
test_delete_invalid_id "/v1/suppliers" "Supplier"

echo "2. PRODUCTS"
echo "==========="
test_get_invalid_id "/v1/products" "Product"
test_put_invalid_id "/v1/products" "Product"
test_delete_invalid_id "/v1/products" "Product"

echo "3. STOCKS"
echo "========="
test_get_invalid_id "/v1/stocks" "Stock"
test_put_invalid_id "/v1/stocks" "Stock"
test_delete_invalid_id "/v1/stocks" "Stock"

echo "4. PURCHASE ORDERS"
echo "=================="
test_get_invalid_id "/v1/purchaseorders" "PurchaseOrder"
test_put_invalid_id "/v1/purchaseorders" "PurchaseOrder"
test_delete_invalid_id "/v1/purchaseorders" "PurchaseOrder"

echo "5. PURCHASE REQUESTS"
echo "===================="
test_get_invalid_id "/v1/purchaserequests" "PurchaseRequest"
test_put_invalid_id "/v1/purchaserequests" "PurchaseRequest"
test_delete_invalid_id "/v1/purchaserequests" "PurchaseRequest"

echo "6. PICKLISTS"
echo "============"
test_get_invalid_id "/v1/picklists" "Picklist"
test_put_invalid_id "/v1/picklists" "Picklist"
test_delete_invalid_id "/v1/picklists" "Picklist"

echo "=== TEST COMPLETED ===" 