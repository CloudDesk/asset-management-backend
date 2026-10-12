-- "Return / Replace all items": requests raised together for one order share a group number
-- (one request per order line is kept; refunds, credit notes and inspection stay per item).
ALTER TABLE "return_requests" ADD COLUMN IF NOT EXISTS "groupnumber" VARCHAR(100);
CREATE INDEX IF NOT EXISTS "idx_return_requests_groupnumber" ON "return_requests"("groupnumber");
