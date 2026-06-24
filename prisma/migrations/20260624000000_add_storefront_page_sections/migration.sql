CREATE TABLE IF NOT EXISTS storefront_page_sections (
    id BIGSERIAL PRIMARY KEY,
    page_key VARCHAR(80) NOT NULL DEFAULT 'home',
    section_key VARCHAR(120) NOT NULL,
    section_type VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    schedule_start TIMESTAMPTZ NULL,
    schedule_end TIMESTAMPTZ NULL,
    version INTEGER NOT NULL DEFAULT 1,
    createdby INTEGER NULL,
    modifiedby INTEGER NULL,
    createddate BIGINT NULL,
    modifieddate BIGINT NULL,

    CONSTRAINT chk_storefront_page_sections_schedule
        CHECK (
            schedule_start IS NULL
            OR schedule_end IS NULL
            OR schedule_start < schedule_end
        ),

    CONSTRAINT chk_storefront_page_sections_sort_order
        CHECK (sort_order >= 0),

    CONSTRAINT chk_storefront_page_sections_version
        CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_storefront_page_sections_page_section
    ON storefront_page_sections(page_key, section_key);

CREATE INDEX IF NOT EXISTS idx_storefront_page_sections_active_order
    ON storefront_page_sections(page_key, section_key, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_storefront_page_sections_type
    ON storefront_page_sections(section_type);

CREATE INDEX IF NOT EXISTS idx_storefront_page_sections_attributes_gin
    ON storefront_page_sections USING GIN (attributes);

COMMENT ON TABLE storefront_page_sections IS 'Configurable storefront page sections such as home hero carousel, showcase, product rails, and future homepage modules.';
COMMENT ON COLUMN storefront_page_sections.page_key IS 'Page identifier, for example home, products, or collection.';
COMMENT ON COLUMN storefront_page_sections.section_key IS 'Stable section placement key, for example home.hero or home.showcase.';
COMMENT ON COLUMN storefront_page_sections.section_type IS 'Renderer type chosen by application code, for example hero_carousel, showcase, product_carousel.';
COMMENT ON COLUMN storefront_page_sections.attributes IS 'Section-specific JSON config. Hero uses slides[], showcase uses items[], each with item-level sort_order.';
COMMENT ON COLUMN storefront_page_sections.sort_order IS 'Controls section order on the page.';
