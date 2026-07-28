import type { Prisma } from '@prisma/client';

type ProductWhere = Prisma.ProductWhereInput;

const valueVariants: Record<string, ProductWhere[]> = {
  incense_rituals: [
    { category: 'incense_rituals' },
    { category: 'home_fragrance', subcategory: 'incense' },
  ],
  incense: [
    { category: 'incense_rituals' },
    { category: 'home_fragrance', subcategory: 'incense' },
  ],
  home_car_fragrance: [
    { category: 'home_car_fragrance' },
    { category: 'home_fragrance', subcategory: 'car_&_room_fresheners' },
    {
      category: 'aromatherapy_&_wellness',
      subcategory: { in: ['essential_oils', 'fragrance_blends', 'diffusers'] },
    },
  ],
  car_room_fresheners: [
    {
      category: 'home_car_fragrance',
      subcategory: {
        in: [
          'home_diffusers',
          'car_diffusers',
          'reed_diffusers',
          'air_fresheners',
          'wardrobe_fragrance',
          'fragrance_oils',
        ],
      },
    },
    { category: 'home_fragrance', subcategory: 'car_&_room_fresheners' },
    { category: 'aromatherapy_&_wellness', subcategory: { in: ['fragrance_blends', 'diffusers'] } },
  ],
  home_fragrance: [
    { category: 'home_fragrance' },
    { category: 'incense_rituals' },
    {
      category: 'home_car_fragrance',
      subcategory: {
        in: [
          'home_diffusers',
          'car_diffusers',
          'reed_diffusers',
          'air_fresheners',
          'wardrobe_fragrance',
          'scented_candles',
        ],
      },
    },
    { category: 'daily_rituals' },
  ],
  'aromatherapy_&_wellness': [
    { category: 'aromatherapy_&_wellness' },
    {
      category: 'home_car_fragrance',
      subcategory: { in: ['home_diffusers', 'car_diffusers', 'reed_diffusers', 'fragrance_oils'] },
    },
    { category: 'personal_care', subcategory: 'aromatherapy' },
  ],
  home_decor: [
    { category: 'home_decor' },
    { category: 'gift_collections', subcategory: 'decor' },
  ],
  personal_care: [{ category: 'personal_care' }],
  perfumes: [{ category: 'perfumes' }],
  daily_rituals: [
    { category: 'daily_rituals' },
    { puc: { in: ['NIV-0056', 'NIV-0057', 'NIV-0059'] } },
  ],
  gift_collections: [
    { category: 'gift_collections' },
    { category: 'home_decor' },
  ],
  incense_sticks: [
    { subcategory: 'incense_sticks' },
    { subsubcategory: 'premium_incense_sticks' },
  ],
  premium_incense_sticks: [
    { subcategory: 'incense_sticks' },
    { subsubcategory: 'premium_incense_sticks' },
  ],
  dhoop_sticks: [
    { subcategory: 'dhoop_sticks' },
    { subsubcategory: { in: ['premium_dhoop_sticks', 'dhoop_sticks'] } },
  ],
  dhoops: [
    { subcategory: 'dhoop_sticks' },
    { subsubcategory: { in: ['premium_dhoop_sticks', 'dhoop_sticks'] } },
  ],
  havan_cups: [
    { subcategory: 'havan_cups' },
    { subsubcategory: { in: ['premium_havan_cups', 'havan_cups'] } },
  ],
  home_diffusers: [
    { subcategory: 'home_diffusers' },
    { subcategory: 'diffusers', subsubcategory: 'for_home' },
  ],
  car_diffusers: [
    { subcategory: 'car_diffusers' },
    { subcategory: 'diffusers', subsubcategory: 'for_car' },
  ],
  reed_diffusers: [{ subcategory: 'reed_diffusers' }],
  air_fresheners: [
    { subcategory: 'air_fresheners' },
    { subsubcategory: { in: ['room_fresheners', 'car_fresheners'] } },
  ],
  room_fresheners: [
    { subcategory: 'air_fresheners' },
    { subsubcategory: 'room_fresheners' },
  ],
  premium_room_mist: [
    { subcategory: 'air_fresheners' },
    { subsubcategory: 'room_fresheners' },
  ],
  wardrobe_fragrance: [
    { subcategory: 'wardrobe_fragrance' },
    { subsubcategory: 'fragrance_sachets' },
  ],
  wardrobe_sachets: [
    { subcategory: 'wardrobe_fragrance' },
    { subsubcategory: 'fragrance_sachets' },
  ],
  fragrance_sachets: [
    { subcategory: 'wardrobe_fragrance' },
    { subsubcategory: 'fragrance_sachets' },
  ],
  fragrance_oils: [
    { subcategory: 'fragrance_oils' },
    { subcategory: 'fragrance_blends' },
  ],
  fragrance_blends: [
    { subcategory: 'fragrance_oils' },
    { subcategory: 'fragrance_blends' },
  ],
  diffuser_oils: [
    { subcategory: 'fragrance_oils' },
    { subcategory: 'fragrance_blends' },
  ],
  decor: [
    { subcategory: 'decor' },
    { subcategory: { in: ['table_decor', 'wall_decor'] } },
  ],
  table_decor: [
    { subcategory: 'decor' },
    { subcategory: 'table_decor' },
  ],
  fresh_mornings: [
    { subcategory: 'fresh_mornings' },
    { puc: 'NIV-0059' },
  ],
  relaxation_calm: [
    { subcategory: 'relaxation_calm' },
    { puc: 'NIV-0056' },
  ],
  peaceful_nights: [
    { subcategory: 'peaceful_nights' },
    { puc: 'NIV-0057' },
  ],
};

const normalizeTaxonomyValue = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const variantsFor = (value: unknown, fallbackField: 'category' | 'subcategory' | 'subsubcategory') => {
  const normalized = normalizeTaxonomyValue(value);
  if (!normalized) return [];
  return valueVariants[normalized] || [{ [fallbackField]: normalized }];
};

export const buildProductTaxonomyWhere = (filters: {
  category?: unknown;
  subcategory?: unknown;
  subsubcategory?: unknown;
}): ProductWhere => {
  const conditions: ProductWhere[] = [];

  if (filters.category) {
    conditions.push({ OR: variantsFor(filters.category, 'category') });
  }
  if (filters.subcategory) {
    conditions.push({ OR: variantsFor(filters.subcategory, 'subcategory') });
  }
  if (filters.subsubcategory) {
    conditions.push({ OR: variantsFor(filters.subsubcategory, 'subsubcategory') });
  }

  return conditions.length ? { AND: conditions } : {};
};

