# 🚀 Comprehensive Promotion Routes Testing Suite

## Overview

This testing suite provides **maximum coverage testing** for all promotion-related routes in the asset management backend. As an architect-level testing framework, it covers every possible scenario including CRUD operations, edge cases, performance testing, security validation, and stress testing.

## 📋 Test Coverage

### Modules Tested
- **Promotions** (`/v1/promotions`) - Core promotion management
- **Promotion Actions** (`/v1/promotion-actions`) - Discount and reward logic
- **Promotion Rules** (`/v1/promotion-rules`) - Eligibility conditions
- **Promotion Target Links** (`/v1/promotion-target-link`) - Target mappings
- **Promotion Usage Logs** (`/v1/promotion-usage-log`) - Usage tracking
- **Promotional Assets** (`/v1/promotional-assets`) - Marketing content

### Test Categories
- ✅ **CRUD Operations** - Create, Read, Update, Delete
- ✅ **Pagination & Filtering** - Data retrieval optimization
- ✅ **Validation Testing** - Input validation and error handling
- ✅ **Business Logic** - Promotion eligibility evaluation
- ✅ **Performance Testing** - Response time and throughput
- ✅ **Security Testing** - Injection attacks and vulnerability assessment
- ✅ **Edge Cases** - Boundary conditions and error scenarios
- ✅ **Stress Testing** - Concurrent requests and load handling
- ✅ **Data Integrity** - Complex data structures and relationships

## 🛠️ Prerequisites

### Required Tools
```bash
# Install required tools
curl --version    # HTTP client for API testing
jq --version      # JSON processor for response parsing
```

### Server Setup
```bash
# Ensure your server is running
npm run dev       # Development mode
# OR
npm start         # Production mode

# Default server URL: http://localhost:3000
```

## 🚦 Quick Start

### Option 1: Run All Tests (Recommended)
```bash
# Make executable and run master suite
chmod +x run_all_promotion_tests.sh
./run_all_promotion_tests.sh
```

### Option 2: Run Individual Test Suites
```bash
# Basic CRUD and validation tests
chmod +x test_promotions_comprehensive_curl.sh
./test_promotions_comprehensive_curl.sh

# Advanced module testing
chmod +x test_promotions_advanced_curl.sh
./test_promotions_advanced_curl.sh

# Performance and security testing
chmod +x test_promotions_stress_curl.sh
./test_promotions_stress_curl.sh
```

## 📊 Test Scripts Breakdown

### 1. `test_promotions_comprehensive_curl.sh`
**Focus**: Core functionality and basic validation
- ✅ All CRUD operations for promotions
- ✅ Pagination testing (basic, large pages, invalid params)
- ✅ Filtering (single, multiple, complex filters)
- ✅ Date range filtering
- ✅ Promotion eligibility evaluation (GET/POST)
- ✅ Data validation (required fields, invalid types)
- ✅ Error handling (400, 404, 500 responses)
- ✅ JSON malformation handling
- ✅ Edge cases (special characters, large pagination)

**Key Test Scenarios**:
```bash
# Sample tests included:
- Create promotion with all fields
- Create promotion with minimal data
- Invalid promotion type validation
- Get promotion by non-existent ID
- Complex filter combinations
- Eligibility evaluation with cart data
```

### 2. `test_promotions_advanced_curl.sh`
**Focus**: Advanced modules and business logic
- ✅ **Promotion Rules**: User, product, cart, payment rules
- ✅ **Target Links**: Product, category, brand targeting
- ✅ **Usage Logs**: Web, mobile, app platform tracking
- ✅ **Promotional Assets**: Banner, popup, carousel, featured ads
- ✅ Asset scheduling and priority management
- ✅ Image management and audit logs
- ✅ Complex content structures (JSONB)

**Key Test Scenarios**:
```bash
# Sample advanced tests:
- Create user eligibility rules
- Product category targeting
- Usage log platform tracking
- Asset scheduling with date ranges
- Image deletion from assets
- Audit log retrieval
```

### 3. `test_promotions_stress_curl.sh`
**Focus**: Performance, security, and resilience
- ⚡ **Performance Testing**: Response times under load
- 🛡️ **Security Testing**: SQL injection, XSS, NoSQL injection
- 🔥 **Stress Testing**: Concurrent requests, rate limiting
- 🎯 **Edge Cases**: Unicode, large payloads, deep nesting
- 📊 **Data Validation**: Type confusion, boundary values

**Key Test Scenarios**:
```bash
# Sample stress tests:
- Large pagination performance (< 2000ms)
- Complex filter performance (< 1500ms)
- SQL injection prevention
- XSS attack mitigation
- Concurrent request handling
- Rate limiting verification
```

### 4. `run_all_promotion_tests.sh`
**Focus**: Orchestration and comprehensive reporting
- 🎯 Pre-flight checks (server availability, tool validation)
- 📋 Sequential test execution
- 📊 Result aggregation and analysis
- 📈 HTML report generation
- 🏆 Final assessment with recommendations

## 📈 Expected Results

### Success Criteria
- **95%+ Success Rate**: Production-ready system
- **85%+ Success Rate**: Good system with minor issues
- **70%+ Success Rate**: Acceptable with moderate issues
- **<70% Success Rate**: Requires significant improvements

### Performance Benchmarks
- **Basic queries**: < 500ms
- **Complex filters**: < 1500ms
- **Pagination**: < 2000ms
- **Eligibility evaluation**: < 3000ms

## 📋 Test Results Analysis

### Generated Files
```
promotion_test_results_YYYYMMDD_HHMMSS/
├── master_test_report.html          # Comprehensive HTML report
├── comprehensive_results.log        # Basic CRUD test logs
├── advanced_results.log             # Advanced module test logs
├── stress_results.log               # Performance/security test logs
└── test_promotions_*.sh             # Backup of test scripts
```

### HTML Report Features
- 📊 Visual success rate metrics
- 📈 Progress bars and charts
- 📋 Detailed test breakdown by module
- 🎯 Architect recommendations
- ⏱️ Performance metrics
- 🛡️ Security assessment results

## 🔧 Customization

### Modify Base URL
```bash
# Edit any script to change the target server
BASE_URL="http://your-server:port/v1"
```

### Add Custom Tests
```bash
# Add to any script using the test helper functions
run_test "Your custom test" "expected_status" "curl command"
```

### Performance Thresholds
```bash
# Modify performance expectations in stress script
run_performance_test "Test name" "curl command" max_time_ms
```

## 🐛 Troubleshooting

### Common Issues

**Server Not Running**
```bash
# Check server status
curl -s http://localhost:3000/health
# or
curl -s http://localhost:3000/v1/promotions
```

**Permission Denied**
```bash
# Make scripts executable
chmod +x *.sh
```

**Missing Tools**
```bash
# Install on macOS
brew install curl jq

# Install on Ubuntu/Debian
sudo apt-get install curl jq

# Install on CentOS/RHEL
sudo yum install curl jq
```

**JSON Parse Errors**
- Check if server is returning HTML error pages instead of JSON
- Verify API endpoints are correctly configured
- Check for authentication requirements

## 🎯 Architect Recommendations

Based on comprehensive testing, consider these improvements:

### Performance Optimizations
1. **Caching Layer**: Implement Redis for frequently accessed promotions
2. **Database Indexing**: Optimize queries for filtering and pagination
3. **Connection Pooling**: Implement database connection management
4. **Query Optimization**: Review N+1 queries in complex filters

### Security Enhancements
1. **Rate Limiting**: Implement API rate limiting
2. **Input Sanitization**: Enhanced XSS and injection protection
3. **Authentication**: Ensure all endpoints require proper authentication
4. **Logging**: Comprehensive security event logging

### Reliability Improvements
1. **Circuit Breakers**: Implement fallback mechanisms
2. **Health Checks**: Add detailed health monitoring
3. **Error Handling**: Consistent error response formats
4. **Validation**: Enhanced input validation for edge cases

### Monitoring & Observability
1. **Metrics**: Track response times and error rates
2. **Alerting**: Set up alerts for performance degradation
3. **Tracing**: Implement distributed tracing for complex operations
4. **Dashboards**: Create monitoring dashboards

## 📞 Support

For issues or questions:
1. Check server logs for detailed error information
2. Review the generated HTML report for specific failure details
3. Examine individual log files for detailed test execution traces
4. Verify all prerequisites are properly installed

## 🏷️ Version Information

- **Testing Suite Version**: 1.0
- **Compatible API Version**: v1
- **Last Updated**: 2024
- **Supported Endpoints**: All promotion-related routes

---

**Happy Testing! 🚀**

*This comprehensive testing suite ensures your promotion system is production-ready with maximum reliability, security, and performance.* 