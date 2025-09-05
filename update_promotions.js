#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function updatePromotions() {
  try {
    console.log('🔄 Starting promotion updates...\n');

    // Step 1: Get current promotions
    console.log('📋 Current promotions:');
    const currentPromotions = await prisma.promotions.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        auto_apply: true,
        is_active: true,
        priority: true,
        conditions: true,
        actions: true
      },
      orderBy: { id: 'asc' }
    });

    console.table(currentPromotions);

    // Step 2: Set all auto_apply to FALSE except promotion ID 58
    console.log('\n🔄 Setting all auto_apply to FALSE except ID 58...');
    const updateResult1 = await prisma.promotions.updateMany({
      where: {
        id: { not: 58 }
      },
      data: {
        auto_apply: false,
        modifieddate: BigInt(Date.now())
      }
    });
    console.log(`✅ Updated ${updateResult1.count} promotions`);

    // Step 3: Update promotion 58 for free shipping over ₹500
    console.log('\n🔄 Updating promotion 58 for free shipping over ₹500...');
    const updateResult2 = await prisma.promotions.update({
      where: { id: 58 },
      data: {
        name: 'Free Shipping Over ₹500',
        description: 'Automatic free shipping on orders above ₹500',
        type: 'FREE_SHIPPING',
        code: null,
        auto_apply: true,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2028-12-31'), // Extended to 2028
        status: 'active',
        priority: 10,
        visibility: 'all',
        stackable: true,
        conditions: [
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 500
          }
        ],
        actions: [
          {
            type: 'FREE_SHIPPING',
            value: true
          }
        ],
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Updated promotion 58 with end date 2028-12-31');

    // Step 4: Verify the changes
    console.log('\n📋 Updated promotions:');
    const updatedPromotions = await prisma.promotions.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        auto_apply: true,
        is_active: true,
        priority: true,
        conditions: true
      },
      orderBy: { id: 'asc' }
    });

    console.table(updatedPromotions);

    // Step 5: Show only auto_apply promotions
    console.log('\n🎯 Auto-apply promotions:');
    const autoApplyPromotions = await prisma.promotions.findMany({
      where: { auto_apply: true },
      select: {
        id: true,
        name: true,
        type: true,
        auto_apply: true,
        priority: true,
        conditions: true
      },
      orderBy: { priority: 'asc' }
    });

    console.table(autoApplyPromotions);

    console.log('\n✅ Promotion updates completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`- Total promotions: ${currentPromotions.length}`);
    console.log(`- Auto-apply promotions: ${autoApplyPromotions.length}`);
    console.log(`- Updated promotions: ${updateResult1.count + 1}`);

  } catch (error) {
    console.error('❌ Error updating promotions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updatePromotions();
