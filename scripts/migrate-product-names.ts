/// <reference types="node" />

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildProductNaming } from '../src/utils/productNaming.js';

const prisma = new PrismaClient();
const CONFIRMATION = 'NIVAANA_PRODUCT_NAMES';
const applyRequested = process.argv.includes('--apply');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.split('=')[1];

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim() || '';
  return trimmed.toLowerCase() === 'false' ? '' : trimmed;
};

const deriveRemarksFromLegacyName = (name: string) => {
  const parts = name
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) return parts.slice(2).join(' - ');
  if (parts.length >= 2) return parts.slice(1).join(' - ');
  return clean(name);
};

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
        remarks: true,
      },
      orderBy: { puc: 'asc' },
    }),
    prisma.picklist.findMany({
      where: {
        object: 'product',
        fieldname: 'brand',
        isactive: true,
      },
    }),
  ]);

  const blocked: Array<{ puc: string; reason: string }> = [];
  const changes = products.map((product) => {
    const storedRemarks = clean(product.remarks);
    const proposedRemarks = storedRemarks || deriveRemarksFromLegacyName(product.name);

    if (!clean(product.brand)) {
      blocked.push({ puc: product.puc, reason: 'missing brand' });
    }
    if (!proposedRemarks) {
      blocked.push({ puc: product.puc, reason: 'missing remarks' });
    }
    if (proposedRemarks.length > 1000) {
      blocked.push({ puc: product.puc, reason: 'remarks exceed 1000 characters' });
    }

    let proposedName = '';
    if (clean(product.brand) && proposedRemarks && proposedRemarks.length <= 1000) {
      try {
        proposedName = buildProductNaming({
          product: {
            brand: product.brand,
            remarks: proposedRemarks,
          },
          picklists,
        }).name;
      } catch (error) {
        blocked.push({
          puc: product.puc,
          reason: error instanceof Error ? error.message : 'name generation failed',
        });
      }
    }

    if (proposedName.length > 1200) {
      blocked.push({ puc: product.puc, reason: 'generated name exceeds 1200 characters' });
    }

    return {
      id: product.id,
      puc: product.puc,
      currentName: product.name,
      proposedName,
      currentRemarks: product.remarks,
      proposedRemarks,
      remarksDerived: !storedRemarks && Boolean(proposedRemarks),
    };
  });

  const findCollisions = () => {
    const byName = new Map<string, typeof changes>();
    for (const change of changes) {
      if (!change.proposedName) continue;
      const key = change.proposedName.toLowerCase();
      byName.set(key, [...(byName.get(key) || []), change]);
    }
    return [...byName.values()].filter((group) => group.length > 1);
  };

  const collisionResolutions: Array<{
    puc: string;
    originalProposedName: string;
    resolvedProposedName: string;
  }> = [];
  for (const group of findCollisions()) {
    for (const change of group) {
      const originalProposedName = change.proposedName;
      change.proposedRemarks = `${change.proposedRemarks} - ${change.puc}`;
      change.proposedName = `${change.proposedName} - ${change.puc}`;
      collisionResolutions.push({
        puc: change.puc,
        originalProposedName,
        resolvedProposedName: change.proposedName,
      });
      if (change.proposedRemarks.length > 1000) {
        blocked.push({ puc: change.puc, reason: 'collision-resolved remarks exceed 1000 characters' });
      }
      if (change.proposedName.length > 1200) {
        blocked.push({ puc: change.puc, reason: 'collision-resolved name exceeds 1200 characters' });
      }
    }
  }
  const collisions = findCollisions();
  const changed = changes.filter((change) => change.currentName !== change.proposedName);
  const remarksToPopulate = changes.filter(
    (change) => change.proposedRemarks !== clean(change.currentRemarks),
  );
  const updates = changes.filter(
    (change) =>
      change.proposedName &&
      (change.currentName !== change.proposedName ||
        change.proposedRemarks !== clean(change.currentRemarks)),
  );

  console.log(JSON.stringify({
    mode: applyRequested ? 'APPLY' : 'DRY_RUN',
    products: products.length,
    namesToChange: changed.length,
    unchanged: products.length - changed.length,
    remarksToPopulate: remarksToPopulate.length,
    blocked,
    collisionResolutions,
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
          remarks: change.proposedRemarks,
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
