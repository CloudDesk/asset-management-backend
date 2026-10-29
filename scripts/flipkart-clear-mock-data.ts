/**
 * Remove the simulated Flipkart data written by the mock client (FKT-PLAN-01, FIX-2026-10-29-176).
 *
 * The Flipkart-Integration branch imported mock listings / shipments into the shared dev database
 * (rows with environment / mode = 'MOCK'). Live Flipkart data uses environment 'PRODUCTION', so
 * these rows are never needed once mock mode is off. Only MOCK rows are touched.
 *
 * Stops without deleting anything when a mock shipment still has a RESERVED or SOLD stock
 * reservation, because those moved real platformstock counters (release them first).
 *
 * 1. Dry run (default, changes nothing):
 *      npm run flipkart:clear-mock -- <sit|uat|prod>
 *    → scripts/dryrun-logs/flipkart-clear-mock-<env>-<timestamp>.json
 * 2. Apply:
 *      npm run flipkart:clear-mock -- <env> --apply --confirm=NIVAANA_FLIPKART_CLEAR_MOCK
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

const CONFIRMATION = 'NIVAANA_FLIPKART_CLEAR_MOCK';
const outputDir = path.join(backendRoot, 'scripts/dryrun-logs');

function parseArgs(argv: string[]) {
  const flag = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  return {
    env: parseEnvName(argv.find((arg) => !arg.startsWith('--'))),
    apply: argv.includes('--apply'),
    confirm: flag('confirm'),
  };
}

// Point Prisma at the chosen database before anything imports the client
async function connect(env: EnvName) {
  process.env.DATABASE_URL = readRawDatabaseUrl(ENVIRONMENTS[env].envFile);
  const { prisma } = await import('../src/models/prisma.js');
  const [row] = await prisma.$queryRawUnsafe<Array<{ db: string }>>('SELECT current_database() AS db');
  const db = row?.db ?? '';
  console.log(`Environment: ${env}  (${ENVIRONMENTS[env].envFile})  →  database: ${db}`);
  assertExpectedDatabase(env, db);
  return { prisma, db };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.apply && options.confirm !== CONFIRMATION) throw new Error(`Applying needs --confirm=${CONFIRMATION}`);

  const { prisma, db } = await connect(options.env);
  try {
    const mockShipments = { environment: 'MOCK' };
    const mockListings = { marketplace: 'FLIPKART', environment: 'MOCK' };
    const blocking = await prisma.flipkartOrderStockReservation.findMany({
      where: { status: { in: ['RESERVED', 'SOLD'] }, shipment: mockShipments },
      select: { id: true, status: true, quantity: true, orderItemId: true, shipment: { select: { shipmentId: true } } },
    });

    const counts = {
      shipments: await prisma.flipkartShipment.count({ where: mockShipments }),
      shipmentItems: await prisma.flipkartShipmentItem.count({ where: { shipment: mockShipments } }),
      reservations: await prisma.flipkartOrderStockReservation.count({ where: { shipment: mockShipments } }),
      fulfillmentActions: await prisma.flipkartFulfillmentAction.count({ where: { shipment: mockShipments } }),
      trackingEvents: await prisma.flipkartTrackingEvent.count({ where: { shipment: mockShipments } }),
      listings: await prisma.marketplaceListing.count({ where: mockListings }),
      inventoryPreviews: await prisma.flipkartInventoryPreview.count({ where: { listing: mockListings } }),
      inventoryAttempts: await prisma.flipkartInventorySyncAttempt.count({ where: { listing: mockListings } }),
      connections: await prisma.flipkartConnection.count({ where: { environment: 'MOCK' } }),
      sellerLocations: await prisma.flipkartSellerLocation.count({ where: { connection: { environment: 'MOCK' } } }),
      listingImportJobs: await prisma.flipkartImportJob.count({ where: { mode: 'MOCK' } }),
      orderImportJobs: await prisma.flipkartOrderImportJob.count({ where: { mode: 'MOCK' } }),
    };
    const sampleListings = await prisma.marketplaceListing.findMany({ where: mockListings, select: { sellerSku: true, title: true, mappingStatus: true }, take: 20 });
    const sampleShipments = await prisma.flipkartShipment.findMany({ where: mockShipments, select: { shipmentId: true, shipmentStatus: true }, take: 20 });

    console.table(counts);
    if (blocking.length > 0) {
      console.log('Stopped: these mock reservations moved real stock counters; release them first:');
      console.table(blocking.map((item) => ({ id: String(item.id), shipment: item.shipment.shipmentId, orderItemId: item.orderItemId, status: item.status, quantity: item.quantity })));
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(outputDir, `flipkart-clear-mock-${options.env}-${stamp}.json`);
    fs.writeFileSync(logFile, JSON.stringify({
      env: options.env, db, apply: options.apply, counts, sampleListings, sampleShipments,
      blocking: blocking.map((item) => ({ ...item, id: String(item.id) })),
    }, null, 2));
    console.log(`Log: ${path.relative(backendRoot, logFile)}`);

    if (blocking.length > 0) { process.exitCode = 1; return; }
    if (!options.apply) { console.log(`Dry run only. Apply with --apply --confirm=${CONFIRMATION}`); return; }

    // Children of shipments, listings and connections go with them (ON DELETE CASCADE)
    const deleted = await prisma.$transaction(async (tx) => ({
      shipments: (await tx.flipkartShipment.deleteMany({ where: mockShipments })).count,
      listings: (await tx.marketplaceListing.deleteMany({ where: mockListings })).count,
      listingImportJobs: (await tx.flipkartImportJob.deleteMany({ where: { mode: 'MOCK' } })).count,
      orderImportJobs: (await tx.flipkartOrderImportJob.deleteMany({ where: { mode: 'MOCK' } })).count,
      connections: (await tx.flipkartConnection.deleteMany({ where: { environment: 'MOCK' } })).count,
    }));
    console.log('Deleted:');
    console.table(deleted);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
