/// <reference types="node" />

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY_CONFIRMATION = 'NIVAANA_REPAIR_SUBCATEGORY_PARENTS';
const applyRequested = process.argv.includes('--apply');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.split('=')[1];

const taxonomy = {
  incense_rituals: [
    'incense_sticks',
    'dhoop_sticks',
    'dhoop_cones',
    'havan_cups',
    'incense_accessories',
  ],
  home_car_fragrance: [
    'home_diffusers',
    'car_diffusers',
    'reed_diffusers',
    'air_fresheners',
    'wardrobe_fragrance',
    'fragrance_oils',
    'cleaning_fragrances',
    'scented_candles',
    'candle&candle',
  ],
  personal_care: ['bath_body', 'skincare', 'aromatherapy'],
  perfumes: ['traditional_fragrances', 'everyday_perfumes', 'luxury_perfumes'],
  daily_rituals: ['fresh_mornings', 'relaxation_calm', 'dusky_evenings', 'peaceful_nights'],
  gift_collections: ['festival_gifts', 'wellness_gifts', 'luxury_gifts', 'decor'],
} as const;

const invalidActiveValues = new Set(['candles&candles']);
const expectedParentByValue = new Map<string, string>();

for (const [parent, values] of Object.entries(taxonomy)) {
  for (const value of values) {
    expectedParentByValue.set(value, parent);
  }
}

const main = async () => {
  if (applyRequested && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply requires --confirm=${APPLY_CONFIRMATION}.`);
  }

  const [categories, activeSubcategories] = await Promise.all([
    prisma.picklist.findMany({
      where: { object: 'product', fieldname: 'category', isactive: true },
      select: { id: true, value: true, label: true },
      orderBy: { id: 'asc' },
    }),
    prisma.picklist.findMany({
      where: { object: 'product', fieldname: 'subcategory', isactive: true },
      orderBy: { id: 'asc' },
    }),
  ]);

  const activeCategoryValues = new Set(categories.map((row) => row.value).filter(Boolean));
  const categoryLabelByValue = new Map(
    categories.flatMap((row) => (row.value ? [[row.value, row.label || row.value] as const] : [])),
  );
  const missingCategories = [...new Set(expectedParentByValue.values())].filter(
    (value) => !activeCategoryValues.has(value),
  );
  if (missingCategories.length > 0) {
    throw new Error(`Required active categories are missing: ${missingCategories.join(', ')}`);
  }

  const rowsByValue = new Map<string, typeof activeSubcategories>();
  for (const row of activeSubcategories) {
    if (!row.value) continue;
    rowsByValue.set(row.value, [...(rowsByValue.get(row.value) || []), row]);
  }

  const missingValues = [...expectedParentByValue.keys()].filter((value) => !rowsByValue.has(value));
  const duplicateValues = [...rowsByValue.entries()]
    .filter(([value, rows]) => expectedParentByValue.has(value) && rows.length !== 1)
    .map(([value]) => value);
  const unexpectedRows = activeSubcategories.filter(
    (row) => !row.value || !expectedParentByValue.has(row.value),
  );
  const unsupportedUnexpectedRows = unexpectedRows.filter(
    (row) => !row.value || !invalidActiveValues.has(row.value),
  );

  if (missingValues.length > 0) {
    throw new Error(`Required active subcategories are missing: ${missingValues.join(', ')}`);
  }
  if (duplicateValues.length > 0) {
    throw new Error(`Duplicate active subcategories require manual review: ${duplicateValues.join(', ')}`);
  }
  if (unsupportedUnexpectedRows.length > 0) {
    throw new Error(
      `Unexpected active subcategories require manual review: ${unsupportedUnexpectedRows
        .map((row) => `${row.id}:${row.value || '<null>'}`)
        .join(', ')}`,
    );
  }

  const parentUpdates = [...expectedParentByValue.entries()]
    .map(([value, expectedParent]) => {
      const row = rowsByValue.get(value)![0];
      const expectedLabel = categoryLabelByValue.get(expectedParent)!;
      const isCorrect =
        row.parent === expectedParent &&
        row.controlledfieldname === 'category' &&
        row.controlledvalue === expectedParent &&
        row.controlledlabel === expectedLabel;
      return isCorrect ? null : { row, expectedParent, expectedLabel };
    })
    .filter((change): change is NonNullable<typeof change> => change !== null);
  const invalidRows = unexpectedRows.filter(
    (row) => row.value && invalidActiveValues.has(row.value),
  );

  const summary = {
    activeCategories: categories.length,
    activeSubcategoriesBefore: activeSubcategories.length,
    expectedActiveSubcategories: expectedParentByValue.size,
    parentUpdates: parentUpdates.map(({ row, expectedParent, expectedLabel }) => ({
      id: row.id,
      value: row.value,
      from: {
        parent: row.parent,
        controlledfieldname: row.controlledfieldname,
        controlledvalue: row.controlledvalue,
        controlledlabel: row.controlledlabel,
      },
      to: {
        parent: expectedParent,
        controlledfieldname: 'category',
        controlledvalue: expectedParent,
        controlledlabel: expectedLabel,
      },
    })),
    deactivate: invalidRows.map((row) => ({ id: row.id, label: row.label, value: row.value })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!applyRequested) {
    console.log(`Dry run complete. No rows changed. Apply requires --apply --confirm=${APPLY_CONFIRMATION}.`);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(
    'scripts',
    'dryrun-logs',
    `subcategory-parent-repair-backup-${timestamp}.json`,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      { createdAt: new Date().toISOString(), rows: activeSubcategories },
      (_, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
  );

  const modifieddate = BigInt(Date.now());
  await prisma.$transaction(async (tx) => {
    for (const { row, expectedParent, expectedLabel } of parentUpdates) {
      await tx.picklist.update({
        where: { id: row.id },
        data: {
          parent: expectedParent,
          controlledfieldname: 'category',
          controlledvalue: expectedParent,
          controlledlabel: expectedLabel,
          modifieddate,
        },
      });
    }
    for (const row of invalidRows) {
      await tx.picklist.update({
        where: { id: row.id },
        data: { isactive: false, modifieddate },
      });
    }

    const repairedRows = await tx.picklist.findMany({
      where: { object: 'product', fieldname: 'subcategory', isactive: true },
      select: {
        id: true,
        value: true,
        parent: true,
        controlledfieldname: true,
        controlledvalue: true,
        controlledlabel: true,
      },
    });
    if (repairedRows.length !== expectedParentByValue.size) {
      throw new Error(
        `Verification failed: expected ${expectedParentByValue.size} active subcategories, found ${repairedRows.length}.`,
      );
    }
    for (const row of repairedRows) {
      const expectedParent = row.value ? expectedParentByValue.get(row.value) : undefined;
      const expectedLabel = expectedParent ? categoryLabelByValue.get(expectedParent) : undefined;
      if (
        !expectedParent ||
        row.parent !== expectedParent ||
        row.controlledfieldname !== 'category' ||
        row.controlledvalue !== expectedParent ||
        row.controlledlabel !== expectedLabel
      ) {
        throw new Error(`Verification failed for subcategory ${row.id}:${row.value}.`);
      }
    }
  });

  console.log(`Subcategory parent repair committed successfully. Backup: ${backupPath}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
