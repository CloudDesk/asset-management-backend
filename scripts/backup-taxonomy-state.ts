import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const main = async () => {
  const [products, picklists, gstMappings, productTotals, platformTotals] =
    await Promise.all([
      prisma.product.findMany({
        select: {
          id: true,
          puc: true,
          name: true,
          remarks: true,
          category: true,
          subcategory: true,
          subsubcategory: true,
          modifieddate: true,
        },
        orderBy: { puc: 'asc' },
      }),
      prisma.picklist.findMany({
        where: { object: 'product' },
        orderBy: { id: 'asc' },
      }),
      prisma.gstHsnMapping.findMany({ orderBy: { id: 'asc' } }),
      prisma.product.aggregate({
        _count: { _all: true },
        _sum: {
          quantity: true,
          availablequantity: true,
          soldquantity: true,
          ecompublishedquantity: true,
        },
      }),
      prisma.platformStock.groupBy({
        by: ['platform'],
        _count: { _all: true },
        _sum: { availableqty: true, totalqty: true },
        orderBy: { platform: 'asc' },
      }),
    ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(
    'scripts',
    'dryrun-logs',
    `production-taxonomy-backup-${timestamp}.json`,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        products,
        picklists,
        gstMappings,
        inventory: { productTotals, platformTotals },
      },
      (_, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
  );

  const activeCategories = picklists.filter(
    (row) => row.fieldname === 'category' && row.isactive,
  );
  const activeSubcategories = picklists.filter(
    (row) => row.fieldname === 'subcategory' && row.isactive,
  );
  const activeSubcategoryIds = new Set(activeSubcategories.map((row) => row.id));
  const testPicklists = picklists.filter((row) =>
    [row.fieldname, row.label, row.value, row.parent].some((value) =>
      value?.toLowerCase().includes('test'),
    ),
  );
  const duplicateNames = [
    ...products.reduce<Map<string, string[]>>((groups, product) => {
      const key = product.name.toLowerCase();
      groups.set(key, [...(groups.get(key) || []), product.puc]);
      return groups;
    }, new Map()),
  ].filter(([, pucs]) => pucs.length > 1);
  const invalidGstMappings = gstMappings.filter(
    (mapping) =>
      mapping.isactive &&
      (!mapping.subcategory_id ||
        !activeSubcategoryIds.has(mapping.subcategory_id) ||
        mapping.subsubcategory_id !== null),
  );

  console.log(
    JSON.stringify({
      backupPath,
      productCount: products.length,
      picklistCount: picklists.length,
      gstMappingCount: gstMappings.length,
      taxonomyAudit: {
        activeCategories: activeCategories.length,
        activeSubcategories: activeSubcategories.length,
        activeSubsubcategories: picklists.filter(
          (row) => row.fieldname === 'subsubcategory' && row.isactive,
        ).length,
        inactiveProductPicklists: picklists.filter((row) => !row.isactive).length,
        productsWithSubsubcategory: products.filter(
          (product) => product.subsubcategory !== null,
        ).length,
        testPicklists: testPicklists.length,
        activeGstMappings: gstMappings.filter((mapping) => mapping.isactive).length,
        invalidGstMappings: invalidGstMappings.length,
        duplicateProductNames: duplicateNames.length,
      },
      inventory: { productTotals, platformTotals },
    }),
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
