import type { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';

/**
 * Ecom storefront listing filters (GET /products/platform/:platform?filterMode=storefront).
 *
 * These rules mirror the matching the Ecom Products page previously ran in the
 * browser (Nivaana-Ecom-Web src/pages/Products.tsx and
 * src/components/categoryNavigationData.ts), so moving the filtering to the
 * database returns the same products. Keep both sides in sync.
 *
 * Matching uses normalised keys (case, "&", punctuation and spacing ignored).
 * To keep exact parity, the distinct raw values of each field are matched in
 * JavaScript and the query filters on those raw values.
 */

type ProductWhere = Prisma.ProductWhereInput;
type MatchMode = 'taxonomy' | 'loose';
type TextField = 'category' | 'subcategory' | 'subsubcategory' | 'fragnancetype';

const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

const normalizeFilterKey = (value?: string | null) =>
  normalize(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');

// categoryNavigationData.valuesMatch
const valuesMatch = (left?: string | null, right?: string | null) =>
  Boolean(left && right) && normalizeFilterKey(left) === normalizeFilterKey(right);

const filterKeyVariants = (value?: string | null) => {
  const key = normalizeFilterKey(value);
  if (!key) return new Set<string>();

  return new Set([key, key.replace(/(^|_)and(_|$)/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_')]);
};

// Products.tsx filterValueMatches
const filterValueMatches = (productValue: string | null | undefined, filterValue: string | null | undefined) =>
  Boolean(filterValue) &&
  [...filterKeyVariants(productValue)].some((productKey) => filterKeyVariants(filterValue).has(productKey));

// Products.tsx listValueMatches (comma-separated values such as fragnancetype)
const listValueMatches = (productValue: string | null | undefined, filterValue: string | null | undefined) =>
  Boolean(filterValue) &&
  normalize(productValue)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .some((value) => filterValueMatches(value, filterValue));

const SEARCH_FIELDS = [
  'name',
  'shortname',
  'shortdescription',
  'fulldescription',
  'category',
  'subcategory',
  'subsubcategory',
  'fragnancetype',
  'brand',
  'pack',
  'puc',
] as const;

const asString = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

const asMatchMode = (value: unknown): MatchMode => (value === 'taxonomy' ? 'taxonomy' : 'loose');

const loadDistinctValues = async (field: TextField): Promise<string[]> => {
  const rows = await prisma.product.findMany({
    distinct: [field],
    select: { [field]: true } as Record<TextField, true>,
  });
  return rows
    .map((row: any) => row[field])
    .filter((value: unknown): value is string => typeof value === 'string');
};

export const isStorefrontFilterMode = (filters: Record<string, any>) => filters.filterMode === 'storefront';

/**
 * Prisma conditions (to AND with the platform visibility rule) for the
 * storefront category, excludeCategory, subcategory, subsubcategory, collection and search filters.
 */
export const buildStorefrontListingConditions = async (filters: Record<string, any>): Promise<ProductWhere[]> => {
  const category = asString(filters.category);
  const excludeCategory = asString(filters.excludeCategory);
  const subcategory = asString(filters.subcategory);
  const subsubcategory = asString(filters.subsubcategory);
  const collection = asString(filters.collection);
  const search = typeof filters.search === 'string' ? normalize(filters.search) : '';

  const conditions: ProductWhere[] = [];
  if (!category && !excludeCategory && !subcategory && !subsubcategory && !collection && !search) return conditions;

  const distinctCache = new Map<TextField, Promise<string[]>>();
  const distinctValues = (field: TextField) => {
    if (!distinctCache.has(field)) distinctCache.set(field, loadDistinctValues(field));
    return distinctCache.get(field)!;
  };

  const fieldIn = async (
    field: TextField,
    matches: (value: string) => boolean
  ): Promise<ProductWhere> => {
    const values = (await distinctValues(field)).filter(matches);
    return { [field]: { in: values } };
  };

  // Subcategory / subsubcategory: "taxonomy" when the value is a known child in the
  // category tree, otherwise "loose" (also matches fragrance, used by flavour links).
  const childCondition = async (value: string, mode: MatchMode): Promise<ProductWhere> => {
    if (mode === 'taxonomy') {
      return {
        OR: await Promise.all([
          fieldIn('subcategory', (raw) => valuesMatch(raw, value)),
          fieldIn('subsubcategory', (raw) => valuesMatch(raw, value)),
        ]),
      };
    }
    return {
      OR: await Promise.all([
        fieldIn('subcategory', (raw) => filterValueMatches(raw, value)),
        fieldIn('subsubcategory', (raw) => filterValueMatches(raw, value)),
        fieldIn('fragnancetype', (raw) => filterValueMatches(raw, value) || listValueMatches(raw, value)),
      ]),
    };
  };

  if (category) {
    conditions.push(await fieldIn('category', (raw) => valuesMatch(raw, category)));
  }
  if (excludeCategory) {
    // Products without a category are kept (NOT IN alone would drop NULL rows).
    const excluded = (await distinctValues('category')).filter((raw) => valuesMatch(raw, excludeCategory));
    conditions.push({ OR: [{ category: null }, { category: { notIn: excluded } }] });
  }
  if (subcategory) {
    conditions.push(await childCondition(subcategory, asMatchMode(filters.subcategoryMatch)));
  }
  if (subsubcategory) {
    conditions.push(await childCondition(subsubcategory, asMatchMode(filters.subsubcategoryMatch)));
  }

  if (collection === 'deals') {
    conditions.push({ OR: [{ isdealoftheday: true }, { discount: { gt: 0 } }] });
  } else if (collection === 'gift-sets') {
    conditions.push({
      OR: [
        { pack: { contains: 'pack' } },
        { name: { contains: 'combo', mode: 'insensitive' } },
      ],
    });
  }

  if (search) {
    conditions.push({
      OR: SEARCH_FIELDS.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })),
    });
  }

  return conditions;
};
