import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function insertNewUserOffers() {
  try {
    console.log('🚀 Starting new user offer insertion...\n');

    // New150 (30 days, no order)
    console.log('📝 Inserting New150 (30 days, no order)...');
    const new150_30days = await prisma.promotions.create({
      data: {
        name: 'New User Welcome - ₹150 OFF (30 Days)',
        type: 'FIXED_AMOUNT_OFF_CART',
        code: 'NEW150',
        auto_apply: false,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 1,
        visibility: 'public',
        max_redemptions: 5000,
        per_user_limit: 1,
        stackable: true,
        budget: 750000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'FIXED_AMOUNT_OFF',
        discount_value: 150.00,
        conditions: [
          {
            attribute: 'user.segment',
            operator: 'IN',
            value: ['new_user']
          },
          {
            attribute: 'user.created_date',
            operator: 'DATE_ADD_DAYS',
            value: 30,
            comparison: 'GTE',
            compare_with: 'current_date'
          },
          {
            attribute: 'user.order_count',
            operator: 'EQ',
            value: 0
          },
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 200
          }
        ],
        actions: [
          {
            type: 'FIXED_AMOUNT_OFF',
            value: 150
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ New150 (30 days) inserted with ID:', new150_30days.id);

    // New150 (No date restrictions, no order)
    console.log('📝 Inserting New150 (No date restrictions, no order)...');
    const new150_noDate = await prisma.promotions.create({
      data: {
        name: 'New User Welcome - ₹150 OFF (No Time Limit)',
        type: 'FIXED_AMOUNT_OFF_CART',
        code: 'NEW150_UNLIMITED',
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
        budget: 450000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'FIXED_AMOUNT_OFF',
        discount_value: 150.00,
        conditions: [
          {
            attribute: 'user.segment',
            operator: 'IN',
            value: ['new_user']
          },
          {
            attribute: 'user.order_count',
            operator: 'EQ',
            value: 0
          },
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 200
          }
        ],
        actions: [
          {
            type: 'FIXED_AMOUNT_OFF',
            value: 150
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ New150 (no date) inserted with ID:', new150_noDate.id);

    // New50 (7 days, regardless of orders)
    console.log('📝 Inserting New50 (7 days, regardless of orders)...');
    const new50_7days = await prisma.promotions.create({
      data: {
        name: 'New User Welcome - ₹50 OFF (7 Days)',
        type: 'FIXED_AMOUNT_OFF_CART',
        code: 'NEW50',
        auto_apply: false,
        is_active: true,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active',
        priority: 3,
        visibility: 'public',
        max_redemptions: 8000,
        per_user_limit: 1,
        stackable: true,
        budget: 400000.00,
        timezone: 'Asia/Kolkata',
        evaluation_expiry_minutes: 15,
        discount_type: 'FIXED_AMOUNT_OFF',
        discount_value: 50.00,
        conditions: [
          {
            attribute: 'user.segment',
            operator: 'IN',
            value: ['new_user']
          },
          {
            attribute: 'user.created_date',
            operator: 'DATE_ADD_DAYS',
            value: 7,
            comparison: 'GTE',
            compare_with: 'current_date'
          },
          {
            attribute: 'cart.total_value',
            operator: 'GTE',
            value: 100
          }
        ],
        actions: [
          {
            type: 'FIXED_AMOUNT_OFF',
            value: 50
          }
        ],
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
    console.log('✅ New50 (7 days) inserted with ID:', new50_7days.id);

    console.log('\n🎉 All new user offers inserted successfully!');
    
    // Display summary
    const newUserOffers = await prisma.promotions.findMany({
      where: {
        code: {
          in: ['NEW150', 'NEW150_UNLIMITED', 'NEW50']
        }
      },
      select: {
        id: true,
        name: true,
        code: true,
        discount_value: true,
        max_redemptions: true,
        priority: true
      },
      orderBy: {
        priority: 'asc'
      }
    });

    console.log('\n📊 New User Offers Summary:');
    console.log('=' .repeat(80));
    newUserOffers.forEach(offer => {
      console.log(`ID: ${offer.id} | ${offer.name}`);
      console.log(`Code: ${offer.code} | Discount: ₹${offer.discount_value} | Priority: ${offer.priority}`);
      console.log(`Max Uses: ${offer.max_redemptions}`);
      console.log('-'.repeat(80));
    });

  } catch (error) {
    console.error('❌ Error inserting new user offers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
insertNewUserOffers()
  .then(() => {
    console.log('\n✅ New user offer insertion completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ New user offer insertion failed:', error);
    process.exit(1);
  });
