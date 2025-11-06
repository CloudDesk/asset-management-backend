-- ============================================================================
-- CORRECT WAY TO UPDATE PUC (Example for Product ID 4)
-- This shows why you MUST drop the constraint first
-- ============================================================================

-- ❌ WRONG: This will FAIL (updating product first)
-- UPDATE product SET puc='NIV-0004' WHERE id=4;
-- ERROR: update or delete on table "product" violates foreign key constraint "fk_puc"
--        Key (puc)=(NIV-IS-0004) is still referenced from table "stock".

-- ❌ WRONG: This will also FAIL (updating stock first)
-- UPDATE stock SET puc='NIV-0004' WHERE puc='NIV-IS-0004';
-- ERROR: insert or update on table "stock" violates foreign key constraint "fk_puc"
--        Key (puc)=(NIV-0004) is not present in table "product".

-- ✅ CORRECT: Drop constraint, update both, re-add constraint
BEGIN;

-- Step 1: Temporarily remove the foreign key constraint
ALTER TABLE stock DROP CONSTRAINT IF EXISTS fk_puc;

-- Step 2: Update stock first (now safe, no FK to check)
UPDATE stock 
SET puc = 'NIV-0004', 
    modifieddate = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
WHERE puc = 'NIV-IS-0004';

-- Step 3: Update product (now safe, no FK constraint)
UPDATE product 
SET puc = 'NIV-0004', 
    modifieddate = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
WHERE id = 4;

-- Step 4: Re-add the foreign key constraint (validates everything matches)
ALTER TABLE stock 
ADD CONSTRAINT fk_puc 
FOREIGN KEY (puc) 
REFERENCES product(puc) 
ON DELETE CASCADE 
ON UPDATE NO ACTION;

-- Step 5: Verify it worked
SELECT 
    p.id as product_id,
    p.name,
    p.puc as product_puc,
    COUNT(s.id) as stock_count,
    STRING_AGG(s.id::TEXT, ', ') as stock_ids
FROM product p
LEFT JOIN stock s ON s.puc = p.puc
WHERE p.id = 4
GROUP BY p.id, p.name, p.puc;

-- If the above shows correct values:
-- COMMIT;
-- 
-- If something looks wrong:
-- ROLLBACK;

-- For safety, default to ROLLBACK until you verify
ROLLBACK;

