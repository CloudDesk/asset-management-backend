CREATE TABLE "category_images" (
    "id" SERIAL NOT NULL,
    "picklistid" INTEGER NOT NULL,
    "imageurl" TEXT NOT NULL,
    "objectkey" TEXT NOT NULL,
    "bucket" VARCHAR(255) NOT NULL,
    "alttext" VARCHAR(255),
    "width" INTEGER,
    "height" INTEGER,
    "filesize" INTEGER,
    "mimetype" VARCHAR(100),
    "isactive" BOOLEAN NOT NULL DEFAULT true,
    "createdby" INTEGER,
    "modifiedby" INTEGER,
    "createddate" BIGINT,
    "modifieddate" BIGINT,

    CONSTRAINT "category_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "category_images_dimensions_check"
        CHECK (
            ("width" IS NULL OR "width" > 0)
            AND ("height" IS NULL OR "height" > 0)
        ),
    CONSTRAINT "category_images_filesize_check"
        CHECK ("filesize" IS NULL OR "filesize" >= 0)
);

CREATE UNIQUE INDEX "category_images_picklistid_key"
    ON "category_images"("picklistid");

CREATE INDEX "idx_category_images_isactive"
    ON "category_images"("isactive");

ALTER TABLE "category_images"
    ADD CONSTRAINT "category_images_picklistid_fkey"
    FOREIGN KEY ("picklistid")
    REFERENCES "picklist"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

COMMENT ON TABLE "category_images"
    IS 'Stores managed storefront images for category and subcategory picklist records.';

COMMENT ON COLUMN "category_images"."objectkey"
    IS 'GCP object path used to replace or physically delete the stored image.';
