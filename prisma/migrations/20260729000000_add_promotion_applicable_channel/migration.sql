ALTER TABLE "promotions"
ADD COLUMN "applicable_channel" VARCHAR(20) NOT NULL DEFAULT 'all';

ALTER TABLE "promotions"
ADD CONSTRAINT "promotions_applicable_channel_check"
CHECK ("applicable_channel" IN ('all', 'web', 'mobile'));
