import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const productionApiBaseUrl = (
  process.env.NIVAANA_PRODUCTION_API_BASE_URL
  ?? 'https://nivaana-715569764663.asia-south1.run.app'
).replace(/\/+$/, '');

type SourceProduct = Record<string, unknown> & {
  name?: string;
  puc?: string;
};

type ProductsResponse = {
  success: boolean;
  data: SourceProduct[];
  pagination: {
    page: number;
    totalPages: number;
  };
};

const nullableString = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const nullableInteger = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;

const nullableBigInt = (value: unknown) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
};

const nullableDecimal = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return new Prisma.Decimal(String(value));
  if (typeof value === 'string' && value.trim() !== '') return new Prisma.Decimal(value);
  return null;
};

const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const catalogueValues = (product: SourceProduct): Prisma.ProductUpdateInput => ({
  name: product.name!.trim(),
  shortdescription: nullableString(product.shortdescription),
  fulldescription: nullableString(product.fulldescription),
  category: nullableString(product.category),
  subcategory: nullableString(product.subcategory),
  subsubcategory: nullableString(product.subsubcategory),
  fragnancetype: nullableString(product.fragnancetype),
  large: stringArray(product.large),
  medium: stringArray(product.medium),
  small: stringArray(product.small),
  brand: nullableString(product.brand),
  pack: nullableString(product.pack),
  isdealoftheday: product.isdealoftheday === true,
  averagerating: nullableDecimal(product.averagerating),
  discount: nullableInteger(product.discount),
  price: nullableDecimal(product.price),
  modifieddate: nullableBigInt(product.modifieddate),
  material: nullableString(product.material),
  itemlength: nullableString(product.itemlength),
  manufacturer: nullableString(product.manufacturer),
  netform: nullableString(product.netform),
  netquantity: nullableString(product.netquantity),
  numberofitems: nullableInteger(product.numberofitems),
  itemthickness: nullableString(product.itemthickness),
  purpose: nullableString(product.purpose),
  burntime: nullableString(product.burntime),
  power: nullableString(product.power),
  usage: nullableString(product.usage),
  longevity: nullableString(product.longevity),
  gender: nullableString(product.gender),
  remarks: nullableString(product.remarks),
  iscombo: product.iscombo === true,
  combotype: nullableString(product.combotype) ?? 'fixed',
});

const assertDevelopmentDestination = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\/+/, '').toLowerCase();
  const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (!isLocal && !databaseName.endsWith('_dev')) {
    throw new Error(`Refusing to import into non-development database "${databaseName}"`);
  }
};

const fetchProductionProducts = async () => {
  const products: SourceProduct[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetch(
      `${productionApiBaseUrl}/v1/products/platform/nivapp?page=${page}&limit=100`
    );
    if (!response.ok) {
      throw new Error(`Production catalogue request failed with HTTP ${response.status}`);
    }
    const body = await response.json() as ProductsResponse;
    if (!body.success || !Array.isArray(body.data)) {
      throw new Error('Production catalogue returned an invalid response');
    }
    products.push(...body.data);
    totalPages = body.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return products;
};

const run = async () => {
  assertDevelopmentDestination();
  const sourceProducts = await fetchProductionProducts();
  const validProducts = sourceProducts.filter(
    (product) => typeof product.puc === 'string'
      && product.puc.trim() !== ''
      && typeof product.name === 'string'
      && product.name.trim() !== ''
  );
  const sourcePucs = validProducts.map((product) => product.puc!.trim());
  const existing = new Set(
    (await prisma.product.findMany({
      where: { puc: { in: sourcePucs } },
      select: { puc: true },
    })).map((product) => product.puc)
  );

  let created = 0;
  let updated = 0;
  for (const product of validProducts) {
    const puc = product.puc!.trim();
    const catalogue = catalogueValues(product);
    await prisma.product.upsert({
      where: { puc },
      update: catalogue,
      create: {
        ...catalogue,
        puc,
        createddate: nullableBigInt(product.createddate),
        quantity: nullableInteger(product.quantity) ?? 0,
        orderedquantity: nullableInteger(product.orderedquantity) ?? 0,
        soldquantity: nullableInteger(product.soldquantity) ?? 0,
        availablequantity: nullableInteger(product.availablequantity) ?? 0,
        ecompublishedquantity: nullableInteger(product.ecompublishedquantity) ?? 0,
        productstatus: nullableString(product.productstatus),
      },
    });
    if (existing.has(puc)) updated += 1;
    else created += 1;
  }

  process.stdout.write(JSON.stringify({
    fetched: sourceProducts.length,
    imported: validProducts.length,
    created,
    updated,
    skipped: sourceProducts.length - validProducts.length,
  }));
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
