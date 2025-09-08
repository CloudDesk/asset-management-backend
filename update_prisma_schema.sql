-- Update the promotion_evaluations model in schema.prisma
-- Change DateTime fields to BigInt for UTC timestamp storage

-- The updated model should look like this:
/*
model promotion_evaluations {
  evaluation_id        String   @id @db.VarChar(36)
  user_id              String?  @db.Text
  cart_data            Json?
  original_total       Decimal? @db.Decimal(10, 2)
  discounted_total     Decimal? @db.Decimal(10, 2)
  applied_promotions   Json?
  ineligible_coupons   Json?
  context              Json? // channel, geo, payment_method
  created_at           BigInt   // Changed from DateTime to BigInt
  expires_at           BigInt   // Changed from DateTime to BigInt
  status               String?  @default("active") @db.VarChar(50)
  createddate          BigInt?
  modifieddate         BigInt?
  
  redemptions promotion_redemptions[]
  
  @@index([user_id, created_at])
  @@index([expires_at])
  @@map("promotion_evaluations")
}
*/
