#!/bin/bash

# Transaction API Test Runner
echo "🚀 Transaction API Test Runner"
echo "================================"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to run tests."
    exit 1
fi

# Check if the server is running
echo "🔍 Checking if server is running..."
if curl -s -f http://localhost:5600/health > /dev/null; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running. Please start the server first with 'npm run dev'"
    echo "   Run: npm run dev"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the comprehensive test suite
echo "🧪 Running comprehensive transaction API tests..."
echo "================================"
node test_transactions_comprehensive.js

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 All tests passed successfully!"
else
    echo "❌ Some tests failed. Check the output above for details."
fi

echo "🏁 Test execution completed."
exit $TEST_EXIT_CODE 