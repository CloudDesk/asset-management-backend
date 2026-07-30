ALTER TABLE "category_images"
    ADD COLUMN "thumbnailurl" TEXT,
    ADD COLUMN "thumbnailkey" TEXT;

COMMENT ON COLUMN "category_images"."thumbnailurl"
    IS 'Public URL for the optimized 320x240 administration thumbnail.';

COMMENT ON COLUMN "category_images"."thumbnailkey"
    IS 'GCP object path for physical thumbnail deletion.';
