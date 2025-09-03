# Promotion Module v3 - Implementation Guide

## 📋 Overview

This document outlines the implementation approach for adding the new Promotion Module (v3) to the existing asset management backend. The module provides a centralized system for managing, evaluating, and applying promotions with immutable evaluations, detailed breakdowns, and atomic redemptions.

## 🔍 Current State Analysis

### ✅ Existing Infrastructure

The project already has a solid foundation for the new promotion module:

- **Framework**: Fastify with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod schemas for data validation
- **Caching**: Redis configured for session management
- **Error Handling**: Custom error classes with consistent patterns
- **Existing Promotion System**: Basic promotion tables and services

### 📊 Current Database Schema

```sql
-- Existing promotion tables
promotions
├── id, name, type, code
├── auto_apply, start_date, end_date
├── status, priority, visibility
├── max_redemptions, per_user_limit
└── stackable, createddate, modifieddate

promotion_rules
├── promotion_id, rule_type, condition_key
├── operator, value, value_type
├── logic_group, priority, exclude
└── is_active, notes

promotion_actions
├── promotion_id, action_type, target
├── value_type, value, reward_product_id
├── min_combo_size, apply_to_product_ids
├── max_discount_cap, check_inventory
└── execution_group, action_order

promotion_target_link
├── promotion_id, target_type, target_id
├── target_label, apply_scope
└── is_active

promotion_usage_log
├── promotion_id, user_id, order_id
├── redemption_date, discount_applied
└── platform
```

## 🎯 Required Enhancements

### 1. Database Schema Updates

#### New Fields for Existing Tables

```sql
-- Add to promotions table
ALTER TABLE promotions ADD COLUMN budget DECIMAL(10,2);
ALTER TABLE promotions ADD COLUMN timezone VARCHAR(50);
ALTER TABLE promotions ADD COLUMN evaluation_expiry_minutes INTEGER DEFAULT 15;
ALTER TABLE promotions ADD COLUMN discount_type VARCHAR(50); -- PERCENT_OFF_ITEM, FIXED_AMOUNT_OFF_ITEM, etc.
ALTER TABLE promotions ADD COLUMN discount_value DECIMAL(10,2);
ALTER TABLE promotions ADD COLUMN conditions JSONB;
```

#### New Tables for Immutable Evaluations

```sql
-- Promotion evaluations table
CREATE TABLE promotion_evaluations (
  evaluation_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255),
  cart_data JSONB,
  original_total DECIMAL(10,2),
  discounted_total DECIMAL(10,2),
  applied_promotions JSONB,
  ineligible_coupons JSONB,
  context JSONB, -- channel, geo, payment_method
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active'
);

-- Promotion redemptions table
CREATE TABLE promotion_redemptions (
  id VARCHAR(36) PRIMARY KEY,
  evaluation_id VARCHAR(36) REFERENCES promotion_evaluations(evaluation_id),
  order_id VARCHAR(255),
  user_id VARCHAR(255),
  promotion_id INTEGER REFERENCES promotions(id),
  discount_amount DECIMAL(10,2),
  redeemed_at TIMESTAMP DEFAULT NOW(),
  redemption_data JSONB
);

-- Indexes for performance
CREATE INDEX idx_promotions_active ON promotions(status, start_date, end_date);
CREATE INDEX idx_evaluations_user ON promotion_evaluations(user_id, created_at);
CREATE INDEX idx_evaluations_expires ON promotion_evaluations(expires_at);
CREATE INDEX idx_redemptions_evaluation ON promotion_redemptions(evaluation_id);
CREATE INDEX idx_redemptions_order ON promotion_redemptions(order_id);
```

### 2. Prisma Schema Updates

```prisma
// Add to prisma/schema.prisma

model promotion_evaluations {
  evaluation_id        String   @id @db.VarChar(36)
  user_id              String?  @db.Text
  cart_data            Json?
  original_total       Decimal? @db.Decimal(10, 2)
  discounted_total     Decimal? @db.Decimal(10, 2)
  applied_promotions   Json?
  ineligible_coupons   Json?
  context              Json?
  created_at           DateTime @default(now())
  expires_at           DateTime
  status               String?  @default("active") @db.VarChar(50)
  
  redemptions promotion_redemptions[]
  
  @@index([user_id, created_at])
  @@index([expires_at])
  @@map("promotion_evaluations")
}

model promotion_redemptions {
  id              String   @id @db.VarChar(36)
  evaluation_id   String   @db.VarChar(36)
  order_id        String?  @db.Text
  user_id         String?  @db.Text
  promotion_id    Int?
  discount_amount Decimal? @db.Decimal(10, 2)
  redeemed_at     DateTime @default(now())
  redemption_data Json?
  
  evaluation promotion_evaluations @relation(fields: [evaluation_id], references: [evaluation_id])
  promotion  promotions?            @relation(fields: [promotion_id], references: [id])
  
  @@index([evaluation_id])
  @@index([order_id])
  @@map("promotion_redemptions")
}

// Update existing promotions model
model promotions {
  // ... existing fields ...
  budget                    Decimal? @db.Decimal(10, 2)
  timezone                  String?  @db.VarChar(50)
  evaluation_expiry_minutes Int?     @default(15)
  discount_type             String?  @db.VarChar(50)
  discount_value            Decimal? @db.Decimal(10, 2)
  conditions                Json?
  
  // ... existing relations ...
  redemptions promotion_redemptions[]
}
```

## 🚀 Implementation Phases

### Phase 1: Schema Updates (Week 1)

#### 1.1 Database Migration
```bash
# Generate migration
npx prisma migrate dev --name add_promotion_v3_schema

# Apply migration
npx prisma migrate deploy
```

#### 1.2 Update Prisma Client
```bash
npx prisma generate
```

#### 1.3 Schema Validation
- Update Zod schemas to include new fields
- Add validation for evaluation and redemption data
- Ensure backward compatibility

### Phase 2: Enhanced Services (Week 2)

#### 2.1 New Evaluation Service

```typescript
// src/services/promotion-evaluation-v3.service.ts

export interface EvaluationContext {
  user: {
    user_id: string;
    segment_flags?: string[];
  };
  cart: {
    line_items: Array<{
      id: string;
      sku: string;
      quantity: number;
      price: number;
    }>;
    applied_coupon_codes?: string[];
  };
  context: {
    channel: string;
    geo: string;
  };
  payment_method?: string;
}

export interface EvaluationResult {
  evaluation_id: string;
  original_total: number;
  discounted_total: number;
  applied_promotions: Array<{
    promotion_id: number;
    promotion_name: string;
    discount_amount: number;
    affected_line_item_ids: string[];
  }>;
  ineligible_coupons: Array<{
    coupon_code: string;
    reason: string;
  }>;
  expires_at: Date;
}

export class PromotionEvaluationV3Service {
  async createEvaluation(context: EvaluationContext): Promise<EvaluationResult> {
    // 1. Generate unique evaluation_id
    const evaluationId = this.generateEvaluationId();
    
    // 2. Get active promotions
    const activePromotions = await this.getActivePromotions(context);
    
    // 3. Evaluate each promotion
    const evaluation = await this.evaluatePromotions(activePromotions, context);
    
    // 4. Store immutable evaluation
    await this.storeEvaluation(evaluationId, evaluation, context);
    
    // 5. Return result with expiry
    return {
      ...evaluation,
      evaluation_id: evaluationId,
      expires_at: this.calculateExpiry()
    };
  }
  
  private generateEvaluationId(): string {
    return crypto.randomUUID();
  }
  
  private calculateExpiry(): Date {
    const expiryMinutes = 15; // Configurable
    return new Date(Date.now() + expiryMinutes * 60 * 1000);
  }
  
  // ... other private methods
}
```

#### 2.2 Redemption Service

```typescript
// src/services/promotion-redemption.service.ts

export interface RedemptionRequest {
  evaluation_id: string;
  order_id: string;
}

export interface RedemptionResult {
  redemption_id: string;
  evaluation_id: string;
  order_id: string;
  total_discount: number;
  applied_promotions: Array<{
    promotion_id: number;
    discount_amount: number;
  }>;
  redeemed_at: Date;
}

export class PromotionRedemptionService {
  async redeemEvaluation(request: RedemptionRequest): Promise<RedemptionResult> {
    // 1. Validate evaluation exists and is not expired
    const evaluation = await this.validateEvaluation(request.evaluation_id);
    
    // 2. Check if already redeemed
    const existingRedemption = await this.checkExistingRedemption(request.evaluation_id);
    if (existingRedemption) {
      return existingRedemption; // Idempotent response
    }
    
    // 3. Atomic redemption with transaction
    return await this.performAtomicRedemption(request, evaluation);
  }
  
  private async performAtomicRedemption(
    request: RedemptionRequest, 
    evaluation: any
  ): Promise<RedemptionResult> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create redemption record
      const redemption = await tx.promotion_redemptions.create({
        data: {
          id: crypto.randomUUID(),
          evaluation_id: request.evaluation_id,
          order_id: request.order_id,
          user_id: evaluation.user_id,
          discount_amount: evaluation.discounted_total - evaluation.original_total,
          redemption_data: evaluation
        }
      });
      
      // 2. Update promotion usage logs
      await this.updateUsageLogs(evaluation.applied_promotions, request, tx);
      
      // 3. Update promotion budgets
      await this.updatePromotionBudgets(evaluation.applied_promotions, tx);
      
      return this.formatRedemptionResult(redemption, evaluation);
    });
  }
}
```

### Phase 3: API Endpoints (Week 3)

#### 3.1 New Route Handlers

```typescript
// src/routes/promotions.route.ts

// GET /v1/promotions/active - Banner promotions
fastify.get('/active', {
  schema: {
    description: 'Get active banner promotions',
    tags: ['Promotions'],
    querystring: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel (web, mobile, etc.)' },
        geo: { type: 'string', description: 'Geographic region' },
        scope: { type: 'string', enum: ['banner', 'all'], default: 'banner' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                description: { type: 'string' },
                type: { type: 'string' },
                priority: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }
}, promotionsController.getActivePromotions);

// POST /v1/promotions/evaluate - Core evaluation endpoint
fastify.post('/evaluate', {
  schema: {
    description: 'Evaluate promotions for cart and user context',
    tags: ['Promotions'],
    body: {
      type: 'object',
      properties: {
        context: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            geo: { type: 'string' }
          }
        },
        user: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            segment_flags: { type: 'array', items: { type: 'string' } }
          }
        },
        cart: {
          type: 'object',
          properties: {
            line_items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  sku: { type: 'string' },
                  quantity: { type: 'number' },
                  price: { type: 'number' }
                }
              }
            },
            applied_coupon_codes: { type: 'array', items: { type: 'string' } }
          }
        },
        payment_method: { type: 'string' }
      },
      required: ['context', 'user', 'cart']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              evaluation_id: { type: 'string' },
              original_total: { type: 'number' },
              discounted_total: { type: 'number' },
              applied_promotions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    promotion_id: { type: 'number' },
                    promotion_name: { type: 'string' },
                    discount_amount: { type: 'number' },
                    affected_line_item_ids: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              ineligible_coupons: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    coupon_code: { type: 'string' },
                    reason: { type: 'string' }
                  }
                }
              },
              expires_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  }
}, promotionsController.evaluatePromotions);

// POST /v1/promotions/redeem - Atomic redemption
fastify.post('/redeem', {
  schema: {
    description: 'Redeem a promotion evaluation',
    tags: ['Promotions'],
    body: {
      type: 'object',
      properties: {
        evaluation_id: { type: 'string' },
        order_id: { type: 'string' }
      },
      required: ['evaluation_id', 'order_id']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              redemption_id: { type: 'string' },
              evaluation_id: { type: 'string' },
              order_id: { type: 'string' },
              total_discount: { type: 'number' },
              applied_promotions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    promotion_id: { type: 'number' },
                    discount_amount: { type: 'number' }
                  }
                }
              },
              redeemed_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      409: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          details: { type: 'string' }
        }
      }
    }
  }
}, promotionsController.redeemPromotion);
```

#### 3.2 Enhanced Controller

```typescript
// src/controllers/promotions.controller.ts

export class PromotionsController {
  private evaluationService = new PromotionEvaluationV3Service();
  private redemptionService = new PromotionRedemptionService();
  
  // ... existing methods ...
  
  getActivePromotions = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { channel, geo, scope = 'banner' } = request.query as any;
    
    const promotions = await this.promotionsService.getActivePromotions({
      channel,
      geo,
      scope,
      status: 'active'
    });
    
    const response = createSuccessResponse('Active promotions retrieved', promotions);
    return reply.code(200).send(response);
  });
  
  evaluatePromotions = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const context = request.body as EvaluationContext;
    
    const result = await this.evaluationService.createEvaluation(context);
    
    const response = createSuccessResponse('Promotion evaluation completed', result);
    return reply.code(200).send(response);
  });
  
  redeemPromotion = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { evaluation_id, order_id } = request.body as RedemptionRequest;
    
    try {
      const result = await this.redemptionService.redeemEvaluation({
        evaluation_id,
        order_id
      });
      
      const response = createSuccessResponse('Promotion redeemed successfully', result);
      return reply.code(200).send(response);
    } catch (error: any) {
      if (error.code === 'EVALUATION_EXPIRED') {
        const errorResponse = createErrorResponse(
          'Evaluation expired',
          'The promotion evaluation has expired. Please re-evaluate your cart.',
          409
        );
        return reply.code(409).send(errorResponse);
      }
      
      if (error.code === 'BUDGET_EXHAUSTED') {
        const errorResponse = createErrorResponse(
          'Promotion budget exhausted',
          'The promotion budget has been exhausted since evaluation.',
          409
        );
        return reply.code(409).send(errorResponse);
      }
      
      throw error;
    }
  });
}
```

### Phase 4: Integration & Testing (Week 4)

#### 4.1 Cart Integration

```typescript
// src/services/cart.service.ts

export class CartService {
  // ... existing methods ...
  
  async getCartWithPromotions(userId: string, platform: string): Promise<any> {
    // 1. Get cart items
    const cartItems = await this.getCartByUserId(userId);
    
    // 2. Evaluate promotions
    const evaluationContext: EvaluationContext = {
      user: { user_id: userId },
      cart: {
        line_items: cartItems.map(item => ({
          id: item.id.toString(),
          sku: item.product?.puc || '',
          quantity: item.quantity,
          price: item.product?.price || 0
        })),
        applied_coupon_codes: []
      },
      context: { channel: platform, geo: 'IN' }
    };
    
    const evaluation = await this.evaluationService.createEvaluation(evaluationContext);
    
    return {
      items: cartItems,
      evaluation: evaluation
    };
  }
}
```

#### 4.2 Order Integration

```typescript
// src/services/orders.service.ts

export class OrdersService {
  // ... existing methods ...
  
  async createOrder(orderData: any, evaluationId?: string): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create order
      const order = await tx.orders.create({
        data: {
          // ... order data
        }
      });
      
      // 2. Redeem promotions if evaluation provided
      if (evaluationId) {
        await this.redemptionService.redeemEvaluation({
          evaluation_id: evaluationId,
          order_id: order.orderid
        });
      }
      
      // 3. Create order lines
      // ... order line creation
      
      return order;
    });
  }
}
```

## 📊 Performance Optimization

### 1. Caching Strategy

```typescript
// src/services/promotion-cache.service.ts

export class PromotionCacheService {
  private redis = new Redis();
  
  async getActivePromotions(channel: string, geo: string): Promise<any[]> {
    const cacheKey = `promotions:active:${channel}:${geo}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const promotions = await this.promotionsService.getActivePromotions({
      channel,
      geo,
      status: 'active'
    });
    
    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(promotions));
    
    return promotions;
  }
  
  async getUserSegments(userId: string): Promise<string[]> {
    const cacheKey = `user:segments:${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const segments = await this.getUserSegmentFlags(userId);
    
    // Cache for session duration
    await this.redis.setex(cacheKey, 3600, JSON.stringify(segments));
    
    return segments;
  }
}
```

### 2. Database Optimization

```sql
-- Performance indexes
CREATE INDEX CONCURRENTLY idx_promotions_composite ON promotions(status, start_date, end_date, visibility);
CREATE INDEX CONCURRENTLY idx_promotion_rules_active ON promotion_rules(promotion_id, is_active);
CREATE INDEX CONCURRENTLY idx_promotion_actions_order ON promotion_actions(promotion_id, action_order);
CREATE INDEX CONCURRENTLY idx_promotion_target_scope ON promotion_target_link(promotion_id, target_type, is_active);

-- Partial indexes for better performance
CREATE INDEX CONCURRENTLY idx_promotions_active_only ON promotions(id, name, type, priority) 
WHERE status = 'active' AND start_date <= NOW() AND end_date >= NOW();
```

### 3. Monitoring & Metrics

```typescript
// src/utils/promotion-metrics.ts

export class PromotionMetrics {
  private metrics = new Map();
  
  recordEvaluationLatency(duration: number): void {
    // Record P95 latency for evaluations
    this.metrics.set('evaluation_latency_p95', duration);
  }
  
  recordRedemptionSuccess(): void {
    const count = this.metrics.get('redemption_success') || 0;
    this.metrics.set('redemption_success', count + 1);
  }
  
  recordRedemptionFailure(reason: string): void {
    const failures = this.metrics.get('redemption_failures') || {};
    failures[reason] = (failures[reason] || 0) + 1;
    this.metrics.set('redemption_failures', failures);
  }
  
  getMetrics(): any {
    return Object.fromEntries(this.metrics);
  }
}
```

## 🧪 Testing Strategy

### 1. Unit Tests

```typescript
// src/tests/services/promotion-evaluation-v3.test.ts

describe('PromotionEvaluationV3Service', () => {
  let service: PromotionEvaluationV3Service;
  
  beforeEach(() => {
    service = new PromotionEvaluationV3Service();
  });
  
  test('should create immutable evaluation', async () => {
    const context: EvaluationContext = {
      user: { user_id: 'user-123' },
      cart: {
        line_items: [
          { id: 'li-1', sku: 'SKU001', quantity: 1, price: 100 }
        ],
        applied_coupon_codes: []
      },
      context: { channel: 'web', geo: 'IN' }
    };
    
    const result = await service.createEvaluation(context);
    
    expect(result.evaluation_id).toBeDefined();
    expect(result.expires_at).toBeInstanceOf(Date);
    expect(result.applied_promotions).toBeInstanceOf(Array);
  });
  
  test('should handle stacking logic correctly', async () => {
    // Test promotion stacking rules
  });
  
  test('should respect priority ordering', async () => {
    // Test priority-based promotion selection
  });
});
```

### 2. Integration Tests

```typescript
// src/tests/integration/promotion-flow.test.ts

describe('Promotion Flow Integration', () => {
  test('complete promotion flow', async () => {
    // 1. Create promotion
    const promotion = await createTestPromotion();
    
    // 2. Evaluate cart
    const evaluation = await evaluateCart(testCart);
    
    // 3. Redeem promotion
    const redemption = await redeemPromotion(evaluation.evaluation_id, 'order-123');
    
    // 4. Verify results
    expect(redemption.total_discount).toBeGreaterThan(0);
    expect(redemption.applied_promotions).toHaveLength(1);
  });
  
  test('idempotent redemption', async () => {
    // Test that multiple redemption calls return same result
  });
  
  test('expired evaluation handling', async () => {
    // Test expired evaluation rejection
  });
});
```

### 3. Performance Tests

```typescript
// src/tests/performance/promotion-performance.test.ts

describe('Promotion Performance', () => {
  test('evaluation latency under 150ms', async () => {
    const start = Date.now();
    await service.createEvaluation(largeCartContext);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(150);
  });
  
  test('concurrent evaluations', async () => {
    const promises = Array(100).fill(null).map(() => 
      service.createEvaluation(testContext)
    );
    
    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
  });
});
```

## 📋 Implementation Checklist

### Week 1: Schema Updates
- [ ] Create database migration for new tables
- [ ] Update Prisma schema
- [ ] Generate Prisma client
- [ ] Update Zod schemas
- [ ] Test schema changes

### Week 2: Enhanced Services
- [ ] Implement PromotionEvaluationV3Service
- [ ] Implement PromotionRedemptionService
- [ ] Add caching layer
- [ ] Implement stacking logic
- [ ] Add priority resolution
- [ ] Unit tests for services

### Week 3: API Endpoints
- [ ] Add new route handlers
- [ ] Update controller methods
- [ ] Add request/response schemas
- [ ] Implement error handling
- [ ] Add validation middleware
- [ ] Integration tests

### Week 4: Integration & Testing
- [ ] Integrate with cart service
- [ ] Integrate with order service
- [ ] Performance optimization
- [ ] Add monitoring metrics
- [ ] End-to-end testing
- [ ] Documentation updates

## 🚨 Risk Mitigation

### 1. Backward Compatibility
- Keep existing promotion endpoints functional
- Gradual migration strategy
- Feature flags for new functionality

### 2. Data Integrity
- Atomic transactions for redemptions
- Idempotent operations
- Proper error handling and rollbacks

### 3. Performance
- Database indexing strategy
- Caching implementation
- Load testing before production

### 4. Monitoring
- Latency tracking
- Error rate monitoring
- Budget exhaustion alerts
- Usage analytics

## 📈 Success Metrics

### Technical Metrics
- P95 evaluation latency < 150ms
- P99 redemption latency < 100ms
- 99.9% uptime
- Zero data loss

### Business Metrics
- Increased promotion redemption rates
- Reduced cart abandonment
- Improved user experience
- Better promotion ROI tracking

## 🔄 Future Enhancements

### Phase 2 Features
- A/B testing for promotions
- Machine learning for promotion recommendations
- Real-time promotion updates
- Advanced targeting rules
- Multi-currency support
- Promotion analytics dashboard

---

*This implementation guide provides a comprehensive roadmap for adding the Promotion Module v3 to the existing asset management backend while maintaining compatibility and performance.*
