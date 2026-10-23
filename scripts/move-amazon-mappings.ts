/**
 * Move Amazon listing mappings from one environment's database to another (gap D7 / AMZ-PLAN-23).
 *
 * Mappings (listing → Nivaana product, pack size) live in each database. Product and listing IDs differ
 * between databases, so rows are matched by seller SKU and PUC. Sync mode is never copied: every
 * environment decides that itself (Prod only, after the go-live checklist).
 *
 * 1. Export (read-only) from the source:
 *      npm run amazon:mappings -- export uat
 *    → scripts/dryrun-logs/amazon-mappings-uat-<timestamp>.json
 * 2. Dry run on the target (default, changes nothing): what would be mapped, updated, skipped
 *      npm run amazon:mappings -- import prod --file=scripts/dryrun-logs/amazon-mappings-uat-<timestamp>.json
 * 3. Apply (normal mapping path: audit rows, FBA stock mirror, one-Automatic rule):
 *      npm run amazon:mappings -- import prod --file=... --apply --confirm=NIVAANA_AMAZON_MAPPINGS
 *    Add --remap to also replace listings the target already maps to a different product.
 *
 * Refresh Amazon listings on the target first: a listing the target has never imported is skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ENVIRONMENTS,
  assertExpectedDatabase,
  backendRoot,
  parseEnvName,
  readRawDatabaseUrl,
  type EnvName,
} from './lib/release-environments.js';
import type { ExportedAmazonMapping, MappingTransferAction } from '../src/utils/amazonMappingTransfer.js';

const CONFIRMATION = 'NIVAANA_AMAZON_MAPPINGS';
const outputDir = path.join(backendRoot, 'scripts/dryrun-logs');

type ExportFile = { sourceEnvironment: EnvName; sourceDatabase: string; exportedAt: string; mappings: ExportedAmazonMapping[] };

function parseArgs(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const command = positional[0];
  if (command !== 'export' && command !== 'import') throw new Error('Usage: amazon:mappings -- <export|import> <sit|uat|prod> [...]');
  return {
    command,
    env: parseEnvName(positional[1]),
    file: flag('file'),
    apply: argv.includes('--apply'),
    remap: argv.includes('--remap'),
    confirm: flag('confirm'),
  };
}

// Point Prisma at the chosen database before anything imports the client
async function connect(env: EnvName) {
  process.env.DATABASE_URL = readRawDatabaseUrl(ENVIRONMENTS[env].envFile);
  const { prisma } = await import('../src/models/prisma.js');
  const [{ db }] = await prisma.$queryRawUnsafe<Array<{ db: string }>>('SELECT current_database() AS db');
  console.log(`Environment: ${env}  (${ENVIRONMENTS[env].envFile})  →  database: ${db}`);
  assertExpectedDatabase(env, db);
  return { prisma, db };
}

async function exportMappings(env: EnvName) {
  const { prisma, db } = await connect(env);
  try {
    const rows = await prisma.marketplaceListing.findMany({
      where: { marketplace: 'AMAZON', environment: 'PRODUCTION', mappingStatus: 'MAPPED', productId: { not: null } },
      select: {
        sellerId: true, marketplaceId: true, sellerSku: true, fulfilmentChannel: true, unitsPerListing: true,
        product: { select: { puc: true, name: true } },
      },
      orderBy: [{ sellerId: 'asc' }, { sellerSku: 'asc' }],
    });
    const mappings: ExportedAmazonMapping[] = rows.flatMap((row) => row.product ? [{
      sellerId: row.sellerId,
      marketplaceId: row.marketplaceId,
      sellerSku: row.sellerSku,
      fulfilmentChannel: row.fulfilmentChannel,
      puc: row.product.puc,
      productName: row.product.name,
      unitsPerListing: row.unitsPerListing,
    }] : []);
    const file: ExportFile = { sourceEnvironment: env, sourceDatabase: db, exportedAt: new Date().toISOString(), mappings };
    fs.mkdirSync(outputDir, { recursive: true });
    const stamp = file.exportedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
    const outPath = path.join(outputDir, `amazon-mappings-${env}-${stamp}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`Exported ${mappings.length} mapping(s) → ${path.relative(backendRoot, outPath)}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function importMappings(args: ReturnType<typeof parseArgs>) {
  if (!args.file) throw new Error('import needs --file=<export json>');
  if (args.apply && args.confirm !== CONFIRMATION) throw new Error(`--apply needs --confirm=${CONFIRMATION}`);
  const file = JSON.parse(fs.readFileSync(path.resolve(backendRoot, args.file), 'utf8')) as ExportFile;
  if (!Array.isArray(file.mappings)) throw new Error(`${args.file} is not an amazon:mappings export`);
  if (file.sourceEnvironment === args.env) throw new Error('Source and target are the same environment. Stopped.');
  console.log(`Source: ${file.sourceEnvironment} (${file.sourceDatabase}), exported ${file.exportedAt}, ${file.mappings.length} mapping(s)`);

  const { prisma } = await connect(args.env);
  try {
    const { listingKey, planMappingTransfer, stepsToApply } = await import('../src/utils/amazonMappingTransfer.js');
    const targetRows = await prisma.marketplaceListing.findMany({
      where: { marketplace: 'AMAZON', environment: 'PRODUCTION', sellerSku: { in: file.mappings.map((m) => m.sellerSku) } },
      select: { id: true, sellerId: true, marketplaceId: true, sellerSku: true, productId: true, unitsPerListing: true },
    });
    const listings = new Map(targetRows.map((row) => [
      listingKey(row.sellerId, row.marketplaceId, row.sellerSku),
      { id: String(row.id), productId: row.productId === null ? null : String(row.productId), unitsPerListing: row.unitsPerListing },
    ]));
    const products = await prisma.product.findMany({
      where: { puc: { in: [...new Set(file.mappings.map((m) => m.puc.trim()))], mode: 'insensitive' } },
      select: { id: true, puc: true },
    });
    const productIds = new Map(products.map((product) => [product.puc.trim().toUpperCase(), String(product.id)]));

    const steps = planMappingTransfer(file.mappings, listings, productIds);
    const counts = new Map<MappingTransferAction, number>();
    for (const step of steps) {
      counts.set(step.action, (counts.get(step.action) ?? 0) + 1);
      if (step.action !== 'UNCHANGED') {
        console.log(`  ${step.action.padEnd(15)} ${step.mapping.sellerSku} → ${step.mapping.puc} (pack ${step.mapping.unitsPerListing})`);
      }
    }
    console.log(`\nSummary: ${[...counts].map(([action, count]) => `${action} ${count}`).join(' · ')}`);

    const toApply = stepsToApply(steps, args.remap);
    if (!args.apply) {
      console.log(`\nDry run: ${toApply.length} would be written${counts.get('CONFLICT') && !args.remap ? ' (CONFLICT rows need --remap)' : ''}. Add --apply --confirm=${CONFIRMATION} to write.`);
      return;
    }

    const { amazonListingRepository } = await import('../src/repositories/amazon-listing.repository.js');
    let written = 0;
    for (const step of toApply) {
      const result = await amazonListingRepository.mapListing({
        listingId: step.listingId!,
        productId: step.productId!,
        unitsPerListing: step.mapping.unitsPerListing,
        allowRemap: args.remap,
        sellerId: step.mapping.sellerId,
        marketplaceId: step.mapping.marketplaceId,
        requestedByUserType: `SCRIPT_FROM_${file.sourceEnvironment.toUpperCase()}`, // column is VARCHAR(30)
      });
      if (result.status === 'MAPPED') written += 1;
      else console.log(`  ✖ ${step.mapping.sellerSku}: ${result.status}`);
    }
    console.log(`\nWrote ${written} of ${toApply.length} mapping(s). Mapping history shows them as changed by the script.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'export') await exportMappings(args.env);
  else await importMappings(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
