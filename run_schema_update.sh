#!/bin/bash

echo "🚀 Starting Promotion Schema Update..."

# Database connection details
DB_HOST="monorail.proxy.rlwy.net"
DB_PORT="16601"
DB_NAME="assetmanagement_dev"
DB_USER="postgres"

echo "�� Step 1: Executing schema update SQL..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f update_promotion_tables_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema update completed successfully"
else
    echo "❌ Schema update failed"
    exit 1
fi

echo "🔍 Step 2: Verifying changes..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 'promotion_evaluations' as table_name, COUNT(*) as record_count FROM promotion_evaluations
UNION ALL
SELECT 'promotion_redemptions' as table_name, COUNT(*) as record_count FROM promotion_redemptions;
"

echo ""
echo "🎉 Promotion schema update completed successfully!"
echo ""
echo "Summary of changes:"
echo "- Updated created_at and expires_at in promotion_evaluations to BIGINT"
echo "- Updated redeemed_at in promotion_redemptions to BIGINT"
echo "- Recreated indexes for optimal performance"
echo "- Updated Prisma schema to match database changes"
