ALTER TABLE "promotions"
ADD COLUMN "application_mode" VARCHAR(30) NOT NULL DEFAULT 'click_to_apply';

UPDATE "promotions"
SET "application_mode" = CASE
  WHEN COALESCE("auto_apply", false) = true THEN 'automatic'
  WHEN NULLIF(TRIM("code"), '') IS NOT NULL THEN 'code_entry'
  ELSE 'click_to_apply'
END;

CREATE INDEX "promotions_application_mode_idx"
ON "promotions"("application_mode");
