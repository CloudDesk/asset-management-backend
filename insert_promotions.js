import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function insertPromotions() {
  try {
    console.log('🚀 Starting promotion data insertion...\n');

    // Case 1: Cart-level fixed discount - "₹100 OFF on orders above ₹1000"
    console.log('📝 Inserting Case 1: Cart-level fixed discount...');
    const case1 = await prisma.promotions.create({
      data: {
        name: '₹100 OFF on Orders Above ₹1000',
        type: 'FIXED_AMOUNT_OFF_CART',
        code: null, // Auto-apply
        auto_apply: true,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 1,
        visibility: 'public',
        max_redemptions: 10000,
        per_user_limit: 5,
        stackable: true,
        budget: 1000000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'FIXED_AMOUNT_OFF',
        discount_value: 100.00,
        conditions: [
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 1000
          }
        ],
        actions: [
          {
            type: 'FIXED_AMOUNT_OFF',
            value: 100
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Case 1 inserted with ID:', case1.id);

    // Case 2: Category-based discount - "20% OFF on Wellness products, min cart value ₹500"
    console.log('📝 Inserting Case 2: Category-based discount...');
    const case2 = await prisma.promotions.create({
      data: {
        name: '20% OFF on Wellness Products',

        type: 'PERCENT_OFF_ITEM',
        code: null, // Auto-apply
        auto_apply: true,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 2,
        visibility: 'public',
        max_redemptions: 5000,
        per_user_limit: 3,
        stackable: true,
        budget: 500000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'PERCENT_OFF',
        discount_value: 20.00,
        conditions: [
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 500
          },
          {
            attribute: 'cart.items.category',
            operator: 'IN',
            value: ['Wellness', 'Health', 'Natural']
          }
        ],
        actions: [
          {
            type: 'PERCENT_OFF',
            value: 20
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Case 2 inserted with ID:', case2.id);

    // Case 3: BOGO (Buy One Get One Free) - "Buy 1 Rosemary Essential Oil, Get 1 Free"
    console.log('📝 Inserting Case 3: BOGO promotion...');
    const case3 = await prisma.promotions.create({
      data: {
        name: 'Buy 1 Rosemary Essential Oil, Get 1 Free',
        description: 'Purchase one Rosemary Essential Oil and get another one absolutely free!',
        type: 'BOGO',
        code: 'BOGO_ROSEMARY',
        auto_apply: false, // Requires coupon
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 3,
        visibility: 'public',
        max_redemptions: 2000,
        per_user_limit: 2,
        stackable: false,
        budget: 200000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'BOGO',
        discount_value: 100.00,
        conditions: [
          {
            attribute: 'cart.items.sku',
            operator: 'IN',
            value: ['ROSEMARY_ESSENTIAL_OIL_100ML', 'ROSEMARY_ESSENTIAL_OIL_50ML']
          },
          {
            attribute: 'cart.items.quantity',
            operator: 'GTE',
            value: 1
          }
        ],
        actions: [
          {
            type: 'BOGO',
            value: 1
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Case 3 inserted with ID:', case3.id);

    // Case 4: Free Shipping Festival Offer - "Free shipping for all orders during Diwali (Oct 1–Oct 5)"
    console.log('📝 Inserting Case 4: Free shipping festival...');
    const case4 = await prisma.promotions.create({
      data: {
        name: 'Diwali Free Shipping Festival',
        description: 'Free shipping on all orders during Diwali festival (October 1-5). No minimum order value required.',
        type: 'FREE_SHIPPING',
        code: null, // Auto-apply
        auto_apply: true,
        is_active: true,
        start_date: new Date('2024-10-01'),
        end_date: new Date('2024-10-05'),
        status: 'active',
        priority: 1,
        visibility: 'public',
        max_redemptions: 15000,
        per_user_limit: 10,
        stackable: true,
        budget: 750000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'FREE_SHIPPING',
        discount_value: 50.00,
        conditions: [
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 0
          }
        ],
        actions: [
          {
            type: 'FREE_SHIPPING',
            value: true
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Case 4 inserted with ID:', case4.id);

    // Case 5: Progressive Discount - "Get 5% OFF above ₹1000, 10% OFF above ₹2000"
    console.log('📝 Inserting Case 5: Progressive discount tiers...');
    
    // Tier 1: 5% OFF above ₹1000
    const case5a = await prisma.promotions.create({
      data: {
        name: 'Progressive Discount - 5% OFF (₹1000+)',
        description: 'Get 5% off on orders above ₹1000. Higher discounts available for larger orders.',
        type: 'PERCENT_OFF_CART',
        code: null,
        auto_apply: true,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 4,
        visibility: 'public',
        max_redemptions: 8000,
        per_user_limit: 5,
        stackable: false,
        budget: 400000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'PERCENT_OFF',
        discount_value: 5.00,
        conditions: [
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 1000
          },
          {
            attribute: 'cart.total_value',
            operator: 'LT',
            value: 2000
          }
        ],
        actions: [
          {
            type: 'PERCENT_OFF',
            value: 5
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Case 5a (5% tier) inserted with ID:', case5a.id);

    // Tier 2: 10% OFF above ₹2000
    const case5b = await prisma.promotions.create({
      data: {
        name: 'Progressive Discount - 10% OFF (₹2000+)',
        description: 'Get 10% off on orders above ₹2000. Maximum discount tier.',
        type: 'PERCENT_OFF_CART',
        code: null,
        auto_apply: true,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 3,
        visibility: 'public',
        max_redemptions: 5000,
        per_user_limit: 3,
        stackable: false,
        budget: 600000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'PERCENT_OFF',
        discount_value: 10.00,
        conditions: [
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 2000
          }
        ],
        actions: [
          {
            type: 'PERCENT_OFF',
            value: 10
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Case 5b (10% tier) inserted with ID:', case5b.id);

    // Case 6: Free Product with Limited Stock - "Buy above ₹1500 and get 1 Free Herbal Oil 10ml (limited to 100 units)"
    console.log('📝 Inserting Case 6: Free product with limited stock...');
    const case6 = await prisma.promotions.create({
      data: {
        name: 'Free Herbal Oil with ₹1500+ Purchase',
        description: 'Buy above ₹1500 and get 1 Free Herbal Oil 10ml. Limited to 100 units only!',
        type: 'FREE_PRODUCT',
        code: 'FREE_HERBAL_OIL',
        auto_apply: false, // Requires coupon
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 5,
        visibility: 'public',
        max_redemptions: 100,
        per_user_limit: 1,
        stackable: true,
        budget: 50000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'FREE_PRODUCT',
        discount_value: 150.00,
        conditions: [
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 1500
          }
        ],
        actions: [
          {
            type: 'FREE_PRODUCT',
            value: 'HERBAL_OIL_10ML_SKU'
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Case 6 inserted with ID:', case6.id);

    // Additional sample promotions
    console.log('📝 Inserting additional sample promotions...');
    
    // Welcome Discount
    const welcome = await prisma.promotions.create({
      data: {
        name: 'Welcome Discount - 15% OFF',
        description: 'Special 15% discount for new users on their first order.',
        type: 'PERCENT_OFF_CART',
        code: 'WELCOME15',
        auto_apply: false,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 2,
        visibility: 'public',
        max_redemptions: 3000,
        per_user_limit: 1,
        stackable: true,
        budget: 300000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'PERCENT_OFF',
        discount_value: 15.00,
        conditions: [
          {
            attribute: 'user.segment',
            operator: 'IN',
            value: ['first_order', 'new_user']
          },
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 200
          }
        ],
        actions: [
          {
            type: 'PERCENT_OFF',
            value: 15
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Welcome discount inserted with ID:', welcome.id);

    // Loyalty Member Discount
    const loyalty = await prisma.promotions.create({
      data: {
        name: 'Loyalty Gold Member - 10% OFF',
        description: 'Exclusive 10% discount for Gold tier loyalty members.',
        type: 'PERCENT_OFF_CART',
        code: null,
        auto_apply: true,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 1,
        visibility: 'private',
        max_redemptions: 2000,
        per_user_limit: 10,
        stackable: true,
        budget: 200000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'PERCENT_OFF',
        discount_value: 10.00,
        conditions: [
          {
            attribute: 'user.segment',
            operator: 'IN',
            value: ['loyalty_tier_gold', 'loyalty_tier_platinum']
          }
        ],
        actions: [
          {
            type: 'PERCENT_OFF',
            value: 10
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Loyalty discount inserted with ID:', loyalty.id);

    // Flash Sale
    const flashSale = await prisma.promotions.create({
      data: {
        name: 'Flash Sale - 25% OFF Everything',
        description: 'Limited time flash sale! Get 25% off on all products. Hurry, offer ends soon!',
        type: 'PERCENT_OFF_CART',
        code: 'FLASH25',
        auto_apply: false,
        is_active: true,
        start_date: new Date('2024-06-01'),
        end_date: new Date('2024-06-03'),
        status: 'active',
        priority: 1,
        visibility: 'public',
        max_redemptions: 1000,
        per_user_limit: 1,
        stackable: false,
        budget: 250000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'PERCENT_OFF',
        discount_value: 25.00,
        conditions: [
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 100
          }
        ],
        actions: [
          {
            type: 'PERCENT_OFF',
            value: 25
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ Flash sale inserted with ID:', flashSale.id);

    console.log('\n🎉 All promotions inserted successfully!');
    
    // Display summary
    const allPromotions = await prisma.promotions.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        code: true,
        auto_apply: true,
        is_active: true,
        status: true,
        priority: true,
        visibility: true,
        max_redemptions: true,
        discount_type: true,
        discount_value: true
      },
      orderBy: [
        { priority: 'asc' },
        { id: 'asc' }
      ]
    });

    console.log('\n📊 Summary of inserted promotions:');
    console.log('=' .repeat(80));
    allPromotions.forEach(promo => {
      console.log(`ID: ${promo.id} | ${promo.name}`);
      console.log(`Type: ${promo.type} | Code: ${promo.code || 'Auto-apply'} | Priority: ${promo.priority}`);
      console.log(`Discount: ${promo.discount_value}${promo.discount_type === 'PERCENT_OFF' ? '%' : '₹'} | Max Uses: ${promo.max_redemptions}`);
      console.log(`Status: ${promo.status} | Visibility: ${promo.visibility} | Auto-apply: ${promo.auto_apply}`);
      console.log('-'.repeat(80));
    });

  } catch (error) {
    console.error('❌ Error inserting promotions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
insertPromotions()
  .then(() => {
    console.log('\n✅ Promotion insertion script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Promotion insertion script failed:', error);
    process.exit(1);
  });
