/// <reference types="node" />

import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY_CONFIRMATION = 'NIVAANA_TWO_LEVEL_TAXONOMY';
const applyRequested = process.argv.includes('--apply');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.split('=')[1];
const profile = process.argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1] || 'production';

type TaxonomyTarget = {
  category: string;
  subcategory: string;
};

const categories = [
  ['Incense & Rituals', 'incense_rituals'],
  ['Home & Car Fragrance', 'home_car_fragrance'],
  ['Personal Care', 'personal_care'],
  ['Perfumes', 'perfumes'],
  ['Daily Rituals', 'daily_rituals'],
  ['Gift Collections', 'gift_collections'],
] as const;

const subcategories: Record<string, ReadonlyArray<readonly [string, string]>> = {
  incense_rituals: [
    ['Incense Sticks', 'incense_sticks'],
    ['Dhoop Sticks', 'dhoop_sticks'],
    ['Dhoop Cones', 'dhoop_cones'],
    ['Havan Cups', 'havan_cups'],
    ['Incense Accessories', 'incense_accessories'],
  ],
  home_car_fragrance: [
    ['Home Diffusers', 'home_diffusers'],
    ['Car Diffusers', 'car_diffusers'],
    ['Reed Diffusers', 'reed_diffusers'],
    ['Air Fresheners', 'air_fresheners'],
    ['Wardrobe Fragrance', 'wardrobe_fragrance'],
    ['Fragrance Oils', 'fragrance_oils'],
    ['Cleaning Fragrances', 'cleaning_fragrances'],
    ['Scented Candles', 'scented_candles'],
  ],
  personal_care: [
    ['Bath & Body', 'bath_body'],
    ['Skincare', 'skincare'],
    ['Aromatherapy', 'aromatherapy'],
  ],
  perfumes: [
    ['Traditional Fragrances', 'traditional_fragrances'],
    ['Everyday Perfumes', 'everyday_perfumes'],
    ['Luxury Collection', 'luxury_perfumes'],
  ],
  daily_rituals: [
    ['Fresh Mornings', 'fresh_mornings'],
    ['Relaxation & Calm', 'relaxation_calm'],
    ['Dusky Evenings', 'dusky_evenings'],
    ['Peaceful Nights', 'peaceful_nights'],
  ],
  gift_collections: [
    ['Festival Gifts', 'festival_gifts'],
    ['Wellness Gifts', 'wellness_gifts'],
    ['Luxury Gifts', 'luxury_gifts'],
    ['Decor', 'decor'],
  ],
};

const dailyRitualByPuc: Record<string, string> = {
  'NIV-0056': 'relaxation_calm',
  'NIV-0057': 'peaceful_nights',
  'NIV-0059': 'fresh_mornings',
};

const productionDistribution: Record<string, number> = {
  'incense_rituals/incense_sticks': 26,
  'home_car_fragrance/wardrobe_fragrance': 6,
  'home_car_fragrance/fragrance_oils': 5,
  'home_car_fragrance/air_fresheners': 3,
  'gift_collections/decor': 11,
  'daily_rituals/relaxation_calm': 1,
  'daily_rituals/peaceful_nights': 1,
  'daily_rituals/fresh_mornings': 1,
};

const lowerEnvironmentDistribution: Record<string, number> = {
  'incense_rituals/incense_sticks': 42,
  'home_car_fragrance/wardrobe_fragrance': 10,
  'home_car_fragrance/fragrance_oils': 6,
  'home_car_fragrance/air_fresheners': 7,
  'personal_care/aromatherapy': 1,
  'personal_care/bath_body': 1,
  'gift_collections/decor': 12,
  'daily_rituals/relaxation_calm': 1,
  'daily_rituals/peaceful_nights': 1,
  'daily_rituals/fresh_mornings': 1,
};

const approvedDistributions: Record<string, Record<string, number>> = {
  production: productionDistribution,
  lower: lowerEnvironmentDistribution,
};

const classifyProduct = (product: {
  puc: string;
  category: string | null;
  subcategory: string | null;
  subsubcategory: string | null;
}): TaxonomyTarget | null => {
  if (dailyRitualByPuc[product.puc]) {
    return { category: 'daily_rituals', subcategory: dailyRitualByPuc[product.puc] };
  }
  if (product.category === 'home_decor') {
    return { category: 'gift_collections', subcategory: 'decor' };
  }
  if (product.subsubcategory === 'fragrance_sachets') {
    return { category: 'home_car_fragrance', subcategory: 'wardrobe_fragrance' };
  }
  if (
    product.subcategory === 'fragrance_blends' ||
    product.subsubcategory === 'diffuser_oils'
  ) {
    return { category: 'home_car_fragrance', subcategory: 'fragrance_oils' };
  }
  if (
    product.subsubcategory === 'room_fresheners' ||
    product.subsubcategory === 'premium_room_mist' ||
    product.subsubcategory === 'car_fresheners'
  ) {
    return { category: 'home_car_fragrance', subcategory: 'air_fresheners' };
  }
  if (product.subcategory === 'essential_oils') {
    return { category: 'personal_care', subcategory: 'aromatherapy' };
  }
  if (product.subcategory === 'bath') {
    return { category: 'personal_care', subcategory: 'bath_body' };
  }
  if (
    product.subcategory === 'incense' ||
    product.subcategory === 'incense_sticks' ||
    product.subsubcategory === 'premium_incense_sticks'
  ) {
    return { category: 'incense_rituals', subcategory: 'incense_sticks' };
  }

  // Makes the migration safely repeatable.
  const targetCategory = categories.find(([, value]) => value === product.category)?.[1];
  if (targetCategory) {
    const validSubcategory = subcategories[targetCategory].some(([, value]) => value === product.subcategory);
    if (validSubcategory && product.subcategory) {
      return { category: targetCategory, subcategory: product.subcategory };
    }
  }
  return null;
};

const productTotals = async (tx: Prisma.TransactionClient | PrismaClient) => {
  const aggregate = await tx.product.aggregate({
    _count: { _all: true },
    _sum: {
      quantity: true,
      availablequantity: true,
      soldquantity: true,
      ecompublishedquantity: true,
    },
  });
  const platform = await tx.platformStock.groupBy({
    by: ['platform'],
    _count: { _all: true },
    _sum: { availableqty: true, totalqty: true },
    orderBy: { platform: 'asc' },
  });
  return { aggregate, platform };
};

const sameTotals = (left: unknown, right: unknown) =>
  JSON.stringify(left, (_, value) => (typeof value === 'bigint' ? value.toString() : value)) ===
  JSON.stringify(right, (_, value) => (typeof value === 'bigint' ? value.toString() : value));

const ensurePicklist = async (
  tx: Prisma.TransactionClient,
  input: { label: string; value: string; fieldname: string; parent?: string; sortorder: number },
) => {
  const existing = await tx.picklist.findFirst({
    where: {
      object: 'product',
      fieldname: input.fieldname,
      value: input.value,
      parent: input.parent || null,
    },
    orderBy: { id: 'asc' },
  });
  const data = {
    label: input.label,
    value: input.value,
    object: 'product',
    fieldname: input.fieldname,
    parent: input.parent || null,
    sortorder: input.sortorder,
    isactive: true,
    modifieddate: BigInt(Date.now()),
  };
  if (existing) {
    return tx.picklist.update({ where: { id: existing.id }, data });
  }
  return tx.picklist.create({ data: { ...data, createddate: BigInt(Date.now()) } });
};

const main = async () => {
  const approvedDistribution = approvedDistributions[profile];
  if (!approvedDistribution) {
    throw new Error(`Unknown migration profile "${profile}". Use production or lower.`);
  }
  if (applyRequested && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply blocked. Pass --confirm=${APPLY_CONFIRMATION} with --apply.`);
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      puc: true,
      name: true,
      category: true,
      subcategory: true,
      subsubcategory: true,
    },
    orderBy: { puc: 'asc' },
  });
  const assignments = products.map((product) => ({ product, target: classifyProduct(product) }));
  const unclassified = assignments.filter(({ target }) => !target);
  const distribution = assignments.reduce<Record<string, number>>((result, { target }) => {
    const key = target ? `${target.category}/${target.subcategory}` : 'UNCLASSIFIED';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  console.log(JSON.stringify({
    mode: applyRequested ? 'APPLY' : 'DRY_RUN',
    profile,
    products: products.length,
    distribution,
    unclassified: unclassified.map(({ product }) => ({
      puc: product.puc,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      subsubcategory: product.subsubcategory,
    })),
  }, null, 2));

  if (unclassified.length) {
    throw new Error(`Migration blocked: ${unclassified.length} product(s) do not have an approved mapping.`);
  }
  const distributionMatches =
    Object.keys(distribution).length === Object.keys(approvedDistribution).length &&
    Object.entries(approvedDistribution).every(([key, count]) => distribution[key] === count);
  if (!distributionMatches) {
    throw new Error('Migration blocked: product distribution differs from the approved 54-SKU mapping.');
  }
  if (!applyRequested) {
    console.log(`Dry run complete. No rows changed. Apply requires --apply --confirm=${APPLY_CONFIRMATION}.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const before = await productTotals(tx);

    for (const [categoryIndex, [label, value]] of categories.entries()) {
      await ensurePicklist(tx, {
        label,
        value,
        fieldname: 'category',
        sortorder: categoryIndex + 1,
      });
      for (const [subcategoryIndex, [subcategoryLabel, subcategoryValue]] of subcategories[value].entries()) {
        await ensurePicklist(tx, {
          label: subcategoryLabel,
          value: subcategoryValue,
          fieldname: 'subcategory',
          parent: value,
          sortorder: subcategoryIndex + 1,
        });
      }
    }

    for (const { product, target } of assignments) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          category: target!.category,
          subcategory: target!.subcategory,
          subsubcategory: null,
        },
      });
    }

    const dynamicParents = [
      { fieldname: 'fragnancetype', oldParent: 'premium_incense_sticks', newParent: 'incense_sticks', minimum: 13 },
      { fieldname: 'fragnancetype', oldParent: 'fragrance_blends', newParent: 'fragrance_oils', minimum: 5 },
      { fieldname: 'fragnancetype', oldParent: 'fragrance_sachets', newParent: 'wardrobe_fragrance', minimum: 6 },
      { fieldname: 'fragnancetype', oldParent: 'room_fresheners', newParent: 'air_fresheners', minimum: 3 },
      { fieldname: 'gender', oldParent: 'fragrance_sachets', newParent: 'wardrobe_fragrance', minimum: 3 },
    ];
    for (const mapping of dynamicParents) {
      const result = await tx.picklist.updateMany({
        where: {
          object: 'product',
          fieldname: mapping.fieldname,
          parent: { in: [mapping.oldParent, mapping.newParent] },
        },
        data: { parent: mapping.newParent, isactive: true, modifieddate: BigInt(Date.now()) },
      });
      if (result.count < mapping.minimum) {
        throw new Error(
          `Picklist parent update for ${mapping.newParent} expected at least ${mapping.minimum} rows, found ${result.count}.`,
        );
      }
    }

    const powerOptions = await tx.picklist.findMany({
      where: { object: 'product', fieldname: 'power', parent: 'diffusers', isactive: true },
    });
    if (powerOptions.length !== 3) {
      throw new Error(`Power option duplication expected 3 source rows, found ${powerOptions.length}.`);
    }
    for (const parent of ['home_diffusers', 'car_diffusers']) {
      for (const [index, option] of powerOptions.entries()) {
        await ensurePicklist(tx, {
          label: option.label || option.value || '',
          value: option.value || '',
          fieldname: option.fieldname || 'power',
          parent,
          sortorder: option.sortorder ?? index + 1,
        });
      }
    }

    await tx.picklist.updateMany({
      where: {
        object: 'product',
        fieldname: 'category',
        value: { in: ['home_fragrance', 'aromatherapy_&_wellness', 'home_decor', 'incense'] },
      },
      data: { isactive: false, modifieddate: BigInt(Date.now()) },
    });
    await tx.picklist.updateMany({
      where: {
        object: 'product',
        fieldname: 'subcategory',
        OR: [
          { parent: { in: ['home_fragrance', 'aromatherapy_&_wellness', 'home_decor', 'incense'] } },
          {
            parent: 'personal_care',
            value: { notIn: subcategories.personal_care.map(([, value]) => value) },
          },
        ],
      },
      data: { isactive: false, modifieddate: BigInt(Date.now()) },
    });
    await tx.picklist.updateMany({
      where: { object: 'product', fieldname: 'subsubcategory' },
      data: { isactive: false, modifieddate: BigInt(Date.now()) },
    });

    const after = await productTotals(tx);
    if (!sameTotals(before, after)) {
      throw new Error('Inventory invariant failed; transaction rolled back because stock totals changed.');
    }
    const remainingSubsubcategories = await tx.product.count({
      where: { subsubcategory: { not: null } },
    });
    if (remainingSubsubcategories !== 0) {
      throw new Error('Taxonomy invariant failed; one or more products still has a sub-subcategory.');
    }
  }, { timeout: 60_000 });

  console.log('Taxonomy migration committed successfully.');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
