#!/bin/bash

# =================================================================
# MASTER PROMOTION TESTING SUITE
# Comprehensive Testing Orchestrator for All Promotion Routes
# =================================================================

# Configuration
BASE_URL="http://localhost:5600/v1"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_DIR="promotion_test_results_$TIMESTAMP"
FINAL_REPORT="$RESULTS_DIR/master_test_report.html"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║               PROMOTION ROUTES MASTER TEST SUITE               ║${NC}"
echo -e "${CYAN}║                     Testing as an Architect                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"

# Pre-flight checks
echo -e "\n${BLUE}=== PRE-FLIGHT CHECKS ===${NC}"

# Check if server is running
echo -n "Checking server availability..."
if curl -s "$BASE_URL/health" > /dev/null 2>&1 || curl -s "${BASE_URL%/v1}/health" > /dev/null 2>&1; then
    echo -e " ${GREEN}✓ Server is running${NC}"
else
    echo -e " ${RED}✗ Server is not accessible${NC}"
    echo "Please ensure the server is running on $BASE_URL"
    exit 1
fi

# Check for required tools
echo -n "Checking required tools..."
missing_tools=()
for tool in curl jq; do
    if ! command -v $tool &> /dev/null; then
        missing_tools+=($tool)
    fi
done

if [ ${#missing_tools[@]} -eq 0 ]; then
    echo -e " ${GREEN}✓ All tools available${NC}"
else
    echo -e " ${RED}✗ Missing tools: ${missing_tools[*]}${NC}"
    echo "Please install missing tools before running tests"
    exit 1
fi

# Test server response format
echo -n "Checking API response format..."
response=$(curl -s "$BASE_URL/promotions" 2>/dev/null)
if echo "$response" | jq empty 2>/dev/null; then
    echo -e " ${GREEN}✓ API returns valid JSON${NC}"
else
    echo -e " ${YELLOW}⚠ API response may not be JSON formatted${NC}"
fi

# =================================================================
# TEST EXECUTION
# =================================================================

echo -e "\n${PURPLE}=== EXECUTING TEST SUITES ===${NC}"

# Track overall results
declare -A test_results
total_test_time=0

# Execute comprehensive tests
execute_test_suite() {
    local suite_name="$1"
    local script_name="$2"
    local description="$3"
    
    echo -e "\n${BLUE}Running $suite_name${NC}: $description"
    
    if [ -f "$script_name" ]; then
        start_time=$(date +%s)
        chmod +x "$script_name"
        ./"$script_name" > "$RESULTS_DIR/${suite_name,,}_results.log" 2>&1
        exit_code=$?
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        total_test_time=$((total_test_time + duration))
        
        if [ $exit_code -eq 0 ]; then
            echo -e "${GREEN}✓ $suite_name completed successfully${NC} (${duration}s)"
            test_results["$suite_name"]="PASSED"
        else
            echo -e "${RED}✗ $suite_name failed${NC} (${duration}s)"
            test_results["$suite_name"]="FAILED"
        fi
    else
        echo -e "${RED}✗ $suite_name script not found: $script_name${NC}"
        test_results["$suite_name"]="MISSING"
    fi
}

# Execute all test suites
execute_test_suite "COMPREHENSIVE" "test_promotions_comprehensive_curl.sh" "Basic CRUD and validation tests"
execute_test_suite "ADVANCED" "test_promotions_advanced_curl.sh" "Rules, target links, usage logs, assets"
execute_test_suite "STRESS" "test_promotions_stress_curl.sh" "Performance, security, and edge cases"

# =================================================================
# ANALYSIS AND REPORTING
# =================================================================

echo -e "\n${CYAN}=== ANALYZING RESULTS ===${NC}"

# Count test results from log files
analyze_results() {
    local log_file="$1"
    local suite_name="$2"
    
    if [ -f "$log_file" ]; then
        local total=$(grep -c "^\[.*TEST.*\]" "$log_file" 2>/dev/null || echo "0")
        local passed=$(grep -c "✓ SUCCESS:" "$log_file" 2>/dev/null || echo "0")
        local failed=$(grep -c "✗ FAILED:" "$log_file" 2>/dev/null || echo "0")
        
        echo "$suite_name,$total,$passed,$failed"
    else
        echo "$suite_name,0,0,0"
    fi
}

# Analyze each suite
comp_results=$(analyze_results "$RESULTS_DIR/comprehensive_results.log" "Comprehensive")
adv_results=$(analyze_results "$RESULTS_DIR/advanced_results.log" "Advanced")
stress_results=$(analyze_results "$RESULTS_DIR/stress_results.log" "Stress")

# Calculate totals
total_tests=0
total_passed=0
total_failed=0

while IFS=',' read -r suite total passed failed; do
    total_tests=$((total_tests + total))
    total_passed=$((total_passed + passed))
    total_failed=$((total_failed + failed))
done <<< "$comp_results
$adv_results
$stress_results"

# Calculate success rate
if [ $total_tests -gt 0 ]; then
    success_rate=$((total_passed * 100 / total_tests))
else
    success_rate=0
fi

# =================================================================
# GENERATE HTML REPORT
# =================================================================

echo -e "\n${BLUE}=== GENERATING COMPREHENSIVE REPORT ===${NC}"

cat > "$FINAL_REPORT" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Promotion Routes Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0; font-size: 2em; }
        .metric p { margin: 5px 0 0 0; opacity: 0.9; }
        .success { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); }
        .warning { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); }
        .error { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); }
        .suite-results { margin-bottom: 30px; }
        .suite-header { background: #333; color: white; padding: 15px; border-radius: 5px 5px 0 0; margin: 0; }
        .suite-content { border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 5px 5px; }
        .test-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; }
        .test-header { font-weight: bold; padding: 10px; background: #f0f0f0; border-radius: 3px; }
        .test-row { padding: 8px 10px; border-bottom: 1px solid #eee; }
        .status-pass { color: #4CAF50; font-weight: bold; }
        .status-fail { color: #f44336; font-weight: bold; }
        .recommendations { background: #e8f4f8; padding: 20px; border-radius: 5px; border-left: 4px solid #2196F3; }
        .recommendations ul { margin: 10px 0; padding-left: 20px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
        .chart-container { text-align: center; margin: 20px 0; }
        .progress-bar { width: 100%; height: 20px; background: #ddd; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width 0.3s; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Promotion Routes Test Report</h1>
            <p>Comprehensive API Testing Suite - Generated on $(date)</p>
            <p><strong>Target Server:</strong> $BASE_URL</p>
        </div>

        <div class="summary">
            <div class="metric $([ $success_rate -ge 90 ] && echo 'success' || ([ $success_rate -ge 75 ] && echo 'warning' || echo 'error'))">
                <h3>${success_rate}%</h3>
                <p>Success Rate</p>
            </div>
            <div class="metric">
                <h3>$total_tests</h3>
                <p>Total Tests</p>
            </div>
            <div class="metric success">
                <h3>$total_passed</h3>
                <p>Passed</p>
            </div>
            <div class="metric error">
                <h3>$total_failed</h3>
                <p>Failed</p>
            </div>
        </div>

        <div class="chart-container">
            <h3>Overall Test Progress</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${success_rate}%"></div>
            </div>
            <p>${total_passed} of ${total_tests} tests passed</p>
        </div>

        <div class="suite-results">
            <h2 class="suite-header">📊 Test Suite Results</h2>
            <div class="suite-content">
                <div class="test-grid">
                    <div class="test-header">Test Suite</div>
                    <div class="test-header">Total Tests</div>
                    <div class="test-header">Passed</div>
                    <div class="test-header">Failed</div>
EOF

# Add results for each suite
while IFS=',' read -r suite total passed failed; do
    suite_rate=0
    if [ $total -gt 0 ]; then
        suite_rate=$((passed * 100 / total))
    fi
    
    cat >> "$FINAL_REPORT" << EOF
                    <div class="test-row">$suite</div>
                    <div class="test-row">$total</div>
                    <div class="test-row status-pass">$passed</div>
                    <div class="test-row status-fail">$failed</div>
EOF
done <<< "$comp_results
$adv_results
$stress_results"

cat >> "$FINAL_REPORT" << EOF
                </div>
            </div>
        </div>

        <div class="suite-results">
            <h2 class="suite-header">🔍 Detailed Test Coverage</h2>
            <div class="suite-content">
                <h4>✅ Comprehensive Tests</h4>
                <ul>
                    <li>Basic CRUD operations for all promotion modules</li>
                    <li>Pagination and filtering functionality</li>
                    <li>Data validation and error handling</li>
                    <li>Promotion eligibility evaluation</li>
                </ul>

                <h4>⚡ Advanced Tests</h4>
                <ul>
                    <li>Promotion rules engine testing</li>
                    <li>Target link management</li>
                    <li>Usage log tracking</li>
                    <li>Promotional assets lifecycle</li>
                </ul>

                <h4>🛡️ Stress & Security Tests</h4>
                <ul>
                    <li>Performance under load</li>
                    <li>Security vulnerability assessment</li>
                    <li>Edge case handling</li>
                    <li>Concurrent request management</li>
                </ul>
            </div>
        </div>

        <div class="recommendations">
            <h3>🎯 Architect Recommendations</h3>
            <p>Based on the test results, here are key recommendations for improving the promotion system:</p>
            <ul>
                <li><strong>Performance:</strong> Implement caching for frequently accessed promotion data</li>
                <li><strong>Security:</strong> Add rate limiting and input sanitization</li>
                <li><strong>Reliability:</strong> Implement circuit breakers and fallback mechanisms</li>
                <li><strong>Monitoring:</strong> Add comprehensive logging and alerting</li>
                <li><strong>Scalability:</strong> Consider database connection pooling optimization</li>
                <li><strong>Validation:</strong> Enhance input validation for edge cases</li>
            </ul>
        </div>

        <div class="footer">
            <p>Report generated by Promotion Testing Suite v1.0</p>
            <p>Total execution time: ${total_test_time} seconds</p>
            <p>For detailed logs, check the individual result files in the results directory</p>
        </div>
    </div>
</body>
</html>
EOF

# =================================================================
# FINAL OUTPUT
# =================================================================

echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                        TEST SUMMARY                            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}📊 Overall Results:${NC}"
echo -e "   Total Tests:    ${BLUE}$total_tests${NC}"
echo -e "   Passed:         ${GREEN}$total_passed${NC}"
echo -e "   Failed:         ${RED}$total_failed${NC}"
echo -e "   Success Rate:   ${CYAN}$success_rate%${NC}"
echo -e "   Execution Time: ${PURPLE}${total_test_time}s${NC}"

echo -e "\n${YELLOW}📁 Generated Files:${NC}"
echo -e "   Results Directory: ${CYAN}$RESULTS_DIR${NC}"
echo -e "   HTML Report:       ${CYAN}$FINAL_REPORT${NC}"
echo -e "   Individual Logs:   ${CYAN}$RESULTS_DIR/*_results.log${NC}"

# Final assessment
echo -e "\n${YELLOW}🏆 Final Assessment:${NC}"
if [ $success_rate -ge 95 ]; then
    echo -e "${GREEN}   EXCELLENT: System is production-ready with exceptional quality${NC}"
elif [ $success_rate -ge 85 ]; then
    echo -e "${GREEN}   GOOD: System is stable with minor issues to address${NC}"
elif [ $success_rate -ge 70 ]; then
    echo -e "${YELLOW}   ACCEPTABLE: System has moderate issues requiring attention${NC}"
elif [ $success_rate -ge 50 ]; then
    echo -e "${RED}   POOR: System has significant issues requiring immediate fixes${NC}"
else
    echo -e "${RED}   CRITICAL: System is not ready for production deployment${NC}"
fi

echo -e "\n${BLUE}📖 View the full report: ${CYAN}open $FINAL_REPORT${NC}"

# Copy scripts to results directory for reference
cp test_promotions_*.sh "$RESULTS_DIR/" 2>/dev/null

echo -e "\n${GREEN}✨ Master test suite execution completed!${NC}" 