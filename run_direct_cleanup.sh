#!/bin/bash

echo "🚀 Starting Direct SQL Promotion Data Cleanup..."

# Database connection details (you may need to adjust these)
DB_HOST="monorail.proxy.rlwy.net"
DB_PORT="16601"
DB_NAME="assetmanagement_dev"
DB_USER="postgres"

echo "📊 Step 1: Backing up current database..."
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

echo "📊 Step 2: Executing direct SQL cleanup script..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f direct_sql_cleanup.sql

if [ $? -eq 0 ]; then
    echo "✅ Database cleanup completed successfully"
else
    echo "❌ Database cleanup failed"
    exit 1
fi

echo "🔍 Step 3: Verifying changes..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 'promotion_evaluations' as table_name, COUNT(*) as record_count FROM promotion_evaluations
UNION ALL
SELECT 'promotion_redemptions' as table_name, COUNT(*) as record_count FROM promotion_redemptions;
"

echo ""
echo "🎉 Direct SQL promotion data cleanup completed successfully!"
echo ""
echo "Summary of changes:"
echo "- Deleted all records from promotion_evaluations and promotion_redemptions tables"
echo "- Updated created_at and expires_at columns to use BIGINT for UTC timestamps"
echo "- Recreated indexes for optimal performance"
echo "- Database backed up as backup_*.sql"
