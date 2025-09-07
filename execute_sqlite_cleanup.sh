#!/bin/bash

echo "🚀 Starting SQLite Promotion Data Cleanup and Schema Update..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the project root directory"
    exit 1
fi

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    echo "❌ Error: sqlite3 command not found. Please install SQLite."
    exit 1
fi

# Check if database file exists
if [ ! -f "asset_management.db" ]; then
    echo "❌ Error: asset_management.db file not found"
    exit 1
fi

echo "📊 Step 1: Backing up current database..."
cp asset_management.db asset_management.db.backup.$(date +%Y%m%d_%H%M%S)

echo "📊 Step 2: Executing SQLite cleanup script..."
sqlite3 asset_management.db < delete_promotion_data_sqlite.sql

if [ $? -eq 0 ]; then
    echo "✅ Database cleanup completed successfully"
else
    echo "❌ Database cleanup failed"
    exit 1
fi

echo "🔍 Step 3: Verifying changes..."
echo "Checking promotion_evaluations table structure:"
sqlite3 asset_management.db ".schema promotion_evaluations"

echo ""
echo "Checking record counts:"
sqlite3 asset_management.db "SELECT 'promotion_evaluations' as table_name, COUNT(*) as record_count FROM promotion_evaluations
UNION ALL
SELECT 'promotion_redemptions' as table_name, COUNT(*) as record_count FROM promotion_redemptions;"

echo ""
echo "🎉 SQLite promotion data cleanup and schema update completed successfully!"
echo ""
echo "Summary of changes:"
echo "- Deleted all records from promotion_evaluations and promotion_redemptions tables"
echo "- Updated created_at and expires_at columns to use BIGINT for UTC timestamps"
echo "- Recreated indexes for optimal performance"
echo "- Database backed up as asset_management.db.backup.*"
