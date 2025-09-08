#!/bin/bash

echo "🚀 Starting Promotion Data Cleanup and Schema Update..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the project root directory"
    exit 1
fi

# Step 1: Connect to database and execute the cleanup SQL
echo "📊 Step 1: Deleting all promotion data and updating schema..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found. Please install PostgreSQL client tools."
    exit 1
fi

# Execute the SQL script
echo "Executing SQL cleanup script..."
psql -d asset_management -f delete_promotion_data_and_update_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database cleanup completed successfully"
else
    echo "❌ Database cleanup failed"
    exit 1
fi

# Step 2: Generate new Prisma migration
echo "📝 Step 2: Creating Prisma migration for schema changes..."
npx prisma migrate dev --name update_promotion_evaluations_timestamps_to_bigint

if [ $? -eq 0 ]; then
    echo "✅ Prisma migration created successfully"
else
    echo "❌ Prisma migration failed"
    exit 1
fi

# Step 3: Generate Prisma client
echo "🔧 Step 3: Generating Prisma client..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma client generated successfully"
else
    echo "❌ Prisma client generation failed"
    exit 1
fi

# Step 4: Verify the changes
echo "🔍 Step 4: Verifying changes..."
echo "Checking promotion_evaluations table structure:"
psql -d asset_management -c "\d promotion_evaluations"

echo "Checking record count:"
psql -d asset_management -c "SELECT COUNT(*) as evaluation_count FROM promotion_evaluations;"
psql -d asset_management -c "SELECT COUNT(*) as redemption_count FROM promotion_redemptions;"

echo "🎉 Promotion data cleanup and schema update completed successfully!"
echo ""
echo "Summary of changes:"
echo "- Deleted all records from promotion_evaluations and promotion_redemptions tables"
echo "- Updated created_at and expires_at columns to use BIGINT for UTC timestamps"
echo "- Recreated indexes for optimal performance"
echo "- Updated Prisma schema and generated new migration"
