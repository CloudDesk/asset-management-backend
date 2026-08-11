/// <reference types="node" />

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildProductShortName } from '../src/utils/productShortName.js';

const prisma = new PrismaClient();
const CONFIRMATION = 'NIVAANA_PRODUCT_SHORTNAMES_DEV';
const applyRequested = process.argv.includes('--apply');
const overwriteRequested = process.argv.includes('--overwrite');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.split('=')[1];

type ProductShortNameRow = {
  id: bigint;
  puc: string;
  name: string;
  shortname: string | null;
  remarks: string | null;
};

const main = async () => {
  if (applyRequested && confirmation !== CONFIRMATION) {
    throw new Error(`Apply blocked. Pass --confirm=${CONFIRMATION} with --apply.`);
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  const databaseName = (() => {
    try {
      return new URL(databaseUrl).pathname.replace(/^\//, '');
    } catch {
      return '';
    }
  })();

  if (applyRequested && databaseName !== 'assetmanagement_dev') {
    throw new Error(`Apply blocked: expected assetmanagement_dev, received ${databaseName || 'an unknown database'}.`);
  }

  // Use parameterized SQL so this migration utility does not depend on the
  // developer's generated Prisma Client already containing the new column.
  const products = await prisma.$queryRaw<ProductShortNameRow[]>`
    SELECT "id", "puc", "name", "shortname", "remarks"
    FROM "product"
    ORDER BY "id" ASC
  `;

  const proposed = products.map((product) => ({
    ...product,
    proposedShortName: buildProductShortName(product),
  }));
  const updates = proposed.filter(
    (product) =>
      (overwriteRequested || !product.shortname?.trim()) &&
      product.shortname !== product.proposedShortName,
  );

  console.log(JSON.stringify({
    mode: applyRequested ? 'APPLY' : 'DRY_RUN',
    database: databaseName,
    products: products.length,
    updates: updates.length,
    preservedExisting: products.length - updates.length,
    overwrite: overwriteRequested,
    sample: updates.slice(0, 15).map((product) => ({
      puc: product.puc,
      name: product.name,
      currentShortName: product.shortname,
      proposedShortName: product.proposedShortName,
    })),
  }, null, 2));

  if (!applyRequested) {
    console.log(`Dry run complete. Apply requires --apply --confirm=${CONFIRMATION}.`);
    return;
  }

  const backupPath = path.resolve(
    'scripts',
    'dryrun-logs',
    `product-shortname-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      products.map((product) => ({
        id: product.id.toString(),
        puc: product.puc,
        shortname: product.shortname,
      })),
      null,
      2,
    ),
  );

  await prisma.$transaction(async (transaction) => {
    const modifieddate = BigInt(Date.now());
    for (const product of updates) {
      await transaction.$executeRaw`
        UPDATE "product"
        SET "shortname" = ${product.proposedShortName},
            "modifieddate" = ${modifieddate}
        WHERE "id" = ${product.id}
      `;
    }
  });

  const [population] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "product"
    WHERE "shortname" IS NOT NULL
      AND BTRIM("shortname") <> ''
  `;
  const populated = Number(population?.count || 0);
  if (populated !== products.length) {
    throw new Error(`Verification failed: ${populated}/${products.length} products have short names.`);
  }

  console.log(`Updated ${updates.length} product short names. Backup: ${backupPath}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
