import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildProductNaming } from '../src/utils/productNaming.js';

const prisma = new PrismaClient();
const CONFIRMATION = 'NIVAANA_PRODUCT_NAMES';
const applyRequested = process.argv.includes('--apply');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.split('=')[1];

const toTitleCase = (input: string) =>
  input
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const main = async () => {
  if (applyRequested && confirmation !== CONFIRMATION) {
    throw new Error(`Apply blocked. Pass --confirm=${CONFIRMATION} with --apply.`);
  }

  const [products, picklists] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        puc: true,
        name: true,
        brand: true,
        subcategory: true,
        fragnancetype: true,
        remarks: true,
      },
      orderBy: { puc: 'asc' },
    }),
    prisma.picklist.findMany({
      where: {
        object: 'product',
        fieldname: { in: ['brand', 'subcategory', 'fragnancetype'] },
        isactive: true,
      },
    }),
  ]);

  const fragranceRows = picklists.filter((row) => row.fieldname === 'fragnancetype');
  const fragranceLabel = (subcategory: string, value: string) =>
    fragranceRows.find((row) => row.parent === subcategory && row.value === value)?.label ||
    fragranceRows.find((row) => row.value === value)?.label ||
    toTitleCase(value);
  const normalize = (input: string) =>
    input.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  const blocked: Array<{ puc: string; reason: string }> = [];
  const changes = products.map((product) => {
    if (!product.brand) blocked.push({ puc: product.puc, reason: 'missing brand' });
    if (!product.subcategory) blocked.push({ puc: product.puc, reason: 'missing subcategory' });

    const fragranceLabels = (product.fragnancetype || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => fragranceLabel(product.subcategory || '', value));
    const storedRemarks =
      product.remarks?.trim() && product.remarks.toLowerCase() !== 'false'
        ? product.remarks.trim()
        : '';
    const currentNameParts = product.name
      .split(' - ')
      .map((part) => part.trim())
      .filter(Boolean);
    const remainingNameParts = currentNameParts.slice(2);
    for (const fragrance of fragranceLabels) {
      const index = remainingNameParts.findIndex(
        (part) => normalize(part) === normalize(fragrance),
      );
      if (index >= 0) remainingNameParts.splice(index, 1);
    }
    const derivedRemarks =
      !storedRemarks
        ? remainingNameParts.join(' - ') ||
          (!fragranceLabels.length ? currentNameParts.slice(1).join(' - ') : '')
        : '';
    const { name: proposedName, remarks: proposedRemarks } = buildProductNaming({
      product: {
        brand: product.brand,
        subcategory: product.subcategory,
        fragnancetype: product.fragnancetype,
        remarks: storedRemarks || derivedRemarks,
      },
      picklists,
    });
    if (!proposedName) blocked.push({ puc: product.puc, reason: 'generated name is empty' });
    return {
      id: product.id,
      puc: product.puc,
      currentName: product.name,
      proposedName,
      currentRemarks: product.remarks,
      proposedRemarks,
      remarksDerived: Boolean(derivedRemarks),
    };
  });

  const findCollisions = () => {
    const byName = new Map<string, typeof changes>();
    for (const change of changes) {
      const key = change.proposedName.toLowerCase();
      byName.set(key, [...(byName.get(key) || []), change]);
    }
    return [...byName.values()].filter((group) => group.length > 1);
  };

  for (const group of findCollisions()) {
    if (!group.every((change) => change.remarksDerived && change.proposedRemarks)) continue;
    for (const change of group) {
      change.proposedRemarks = `${change.proposedRemarks} - ${change.puc}`;
      change.proposedName = `${change.proposedName} - ${change.puc}`;
    }
  }
  const collisions = findCollisions();
  const changed = changes.filter((change) => change.currentName !== change.proposedName);
  const remarksToPopulate = changes.filter(
    (change) => change.proposedRemarks !== change.currentRemarks,
  );
  const updates = changes.filter(
    (change) =>
      change.currentName !== change.proposedName ||
      change.proposedRemarks !== change.currentRemarks,
  );
  for (const change of changes) {
    if (change.proposedName.length > 500) {
      blocked.push({ puc: change.puc, reason: 'generated name exceeds 500 characters' });
    }
  }

  console.log(JSON.stringify({
    mode: applyRequested ? 'APPLY' : 'DRY_RUN',
    products: products.length,
    namesToChange: changed.length,
    unchanged: products.length - changed.length,
    remarksToPopulate: remarksToPopulate.length,
    blocked,
    collisionGroups: collisions.map((group) => ({
      proposedName: group[0].proposedName,
      products: group.map(({ puc, currentName }) => ({ puc, currentName })),
    })),
    sample: changed.slice(0, 15).map(({ puc, currentName, proposedName }) => ({
      puc,
      from: currentName,
      to: proposedName,
    })),
  }, null, 2));

  if (blocked.length || collisions.length) {
    throw new Error(
      `Product name migration blocked: ${blocked.length} invalid product(s), ${collisions.length} collision group(s).`,
    );
  }
  if (!applyRequested) {
    console.log(`Dry run complete. No rows changed. Apply requires --apply --confirm=${CONFIRMATION}.`);
    return;
  }

  const backupPath = path.resolve(
    'scripts',
    'dryrun-logs',
    `product-name-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      changes.map(({ id, puc, currentName, currentRemarks }) => ({
        id: id.toString(),
        puc,
        name: currentName,
        remarks: currentRemarks,
      })),
      null,
      2,
    ),
  );

  await prisma.$transaction(async (tx) => {
    const before = await tx.product.aggregate({
      _count: { _all: true },
      _sum: {
        quantity: true,
        availablequantity: true,
        soldquantity: true,
        ecompublishedquantity: true,
      },
    });
    const beforePlatform = await tx.platformStock.groupBy({
      by: ['platform'],
      _sum: { availableqty: true, totalqty: true },
      orderBy: { platform: 'asc' },
    });

    for (const change of updates) {
      await tx.product.update({
        where: { id: change.id },
        data: {
          name: change.proposedName,
          ...(change.proposedRemarks !== change.currentRemarks
            ? { remarks: change.proposedRemarks }
            : {}),
          modifieddate: BigInt(Date.now()),
        },
      });
    }

    const [after, afterPlatform] = await Promise.all([
      tx.product.aggregate({
        _count: { _all: true },
        _sum: {
          quantity: true,
          availablequantity: true,
          soldquantity: true,
          ecompublishedquantity: true,
        },
      }),
      tx.platformStock.groupBy({
        by: ['platform'],
        _sum: { availableqty: true, totalqty: true },
        orderBy: { platform: 'asc' },
      }),
    ]);
    const serialize = (value: unknown) =>
      JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item));
    if (serialize(before) !== serialize(after) || serialize(beforePlatform) !== serialize(afterPlatform)) {
      throw new Error('Inventory invariant failed; product name migration was rolled back.');
    }
  }, { timeout: 60_000 });

  console.log(`Product name migration committed successfully. Backup: ${backupPath}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
