#!/bin/bash

# Orderline Cancellation Test Script
# This script tests the new orderline cancellation functionality

echo "🚀 Starting Orderline Cancellation Tests"
echo "========================================"

# Check if server is running
echo "Checking if server is running..."
if ! curl -s http://localhost:5600/health > /dev/null; then
    echo "❌ Server is not running. Please start the server first."
    exit 1
fi

echo "✅ Server is running"

# Run the comprehensive test
echo ""
echo "Running comprehensive orderline cancellation tests..."
node test_orderline_cancellation_comprehensive.js

echo ""
echo "🎉 Test execution completed!"
echo "Check the output above for test results."
