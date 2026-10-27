/**
 * Create the Inventory combo products that Amazon combo listings need (AMZ-PLAN-27 P5).
 *
 * A combo is virtual stock (C = 1 x A + 1 x B is available as min(A, B)); from FIX-2026-10-27-168
 * an Amazon listing mapped to a combo syncs and reserves through its components. This script
 * creates the missing combos from the reviewed listing comparison CSV, through ProductService.create
 * (same validation, naming, PUC, bundle map and duplicate check as the product form). Only an Amazon
 * platform stock row is created, so these combos do not appear on the Nivaana website.
 *
 * 1. Review the CSV first (components per combo, incense 30-stick vs 10-stick):
 *      docs/Amazon/Amazon_Listings_vs_Inventory_UAT_2026-10-27.csv  (groups 3 and 4 are used)
 * 2. Dry run (default, changes nothing): what would be created, what already exists, what is skipped
 *      npm run amazon:combos -- uat
 *    → scripts/dryrun-logs/amazon-combos-<env>-<timestamp>.json
 * 3. Apply:
 *      npm run amazon:combos -- uat --apply --confirm=NIVAANA_AMAZON_COMBOS
 *    Prod: take a backup first. Optional --file=<csv> for another reviewed list.
 *
 * Mapping the listings to the new combos is a separate step (Amazon → Mappings, or amazon:mappings).
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
import {
  amazonComboComponentKey,
  buildComboPlan,
  parseCsv,
  type ComboCsvRow,
  type ComboPlanEntry,
} from '../src/utils/amazonComboPlan.js';

const CONFIRMATION = 'NIVAANA_AMAZON_COMBOS';
const DEFAULT_FILE = 'docs/Amazon/Amazon_Listings_vs_Inventory_UAT_2026-10-27.csv';
const outputDir = path.join(backendRoot, 'scripts/dryrun-logs');

function parseArgs(argv: string[]) {
  const flag = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  return {
    env: parseEnvName(argv.find((arg) => !arg.startsWith('--'))),
    file: path.resolve(backendRoot, flag('file') ?? DEFAULT_FILE),
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

const line = (entry: ComboPlanEntry) =>
  `${entry.family.padEnd(24)} ${(entry.scents || entry.componentPucs.join(' + ')).slice(0, 70).padEnd(70)} ${entry.componentPucs.join(' + ')}`
  + `  [${entry.listings.map((listing) => listing.sku).join(', ')}]`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.apply && options.confirm !== CONFIRMATION) {
    throw new Error(`Applying needs --confirm=${CONFIRMATION}`);
  }
  const rows = parseCsv(fs.readFileSync(options.file, 'utf8')) as unknown as ComboCsvRow[];
  console.log(`List: ${path.relative(backendRoot, options.file)} (${rows.length} listings)`);

  const { prisma, db } = await connect(options.env);
  try {
    const pucs = [...new Set(rows.flatMap((row) => row.inventory_puc.split('+').map((puc) => puc.trim()).filter(Boolean)))];
    // Raw SQL: some databases still have products without an HSN code, which the Prisma model cannot read
    const products = await prisma.$queryRawUnsafe<Array<{
      id: bigint; puc: string; brand: string | null; category: string | null; subcategory: string | null;
      fragnancetype: string | null; hsn_code: string | null; gst_rate: string | null; iscombo: boolean | null;
    }>>(
      `SELECT id, puc, brand, category, subcategory, fragnancetype, hsn_code, gst_rate::text AS gst_rate, iscombo
         FROM product WHERE puc = ANY($1::text[])`,
      pucs,
    );
    const productsByPuc = new Map(products.map((product) => [product.puc, { ...product, hsn_code: product.hsn_code ?? '', gst_rate: product.gst_rate ?? '' }]));

    const bundles = await prisma.productBundleMap.findMany({
      where: { isactive: true, bundleproduct: { iscombo: true } },
      select: { componentproductid: true, requiredqty: true, bundleproduct: { select: { puc: true } } },
    });
    const componentsByCombo = new Map<string, Array<{ id: bigint; qty: number }>>();
    for (const bundle of bundles) {
      const puc = bundle.bundleproduct.puc;
      componentsByCombo.set(puc, [...(componentsByCombo.get(puc) ?? []), { id: bundle.componentproductid, qty: bundle.requiredqty }]);
    }
    const existingCombos = new Map([...componentsByCombo].map(([puc, items]) =>
      [amazonComboComponentKey(items.map((item) => item.id), items.map((item) => item.qty)), puc]));

    const plan = buildComboPlan(rows, productsByPuc, existingCombos);
    // Same validation as the product form, so the dry run already shows what create would reject
    const { createProductSchema } = await import('../src/schemas/product.schema.js');
    for (const entry of plan) {
      if (entry.action !== 'CREATE') continue;
      const checked = createProductSchema.safeParse(entry.input);
      if (!checked.success) {
        entry.action = 'SKIP';
        entry.reason = `Product validation: ${checked.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`;
      }
    }
    const count = (action: ComboPlanEntry['action']) => plan.filter((entry) => entry.action === action);
    for (const action of ['CREATE', 'EXISTS', 'SKIP'] as const) {
      const entries = count(action);
      console.log(`\n${action === 'CREATE' ? (options.apply ? 'Creating' : 'Would create') : action === 'EXISTS' ? 'Already exists' : 'Skipped'}: ${entries.length}`);
      for (const entry of entries) {
        console.log(`  ${line(entry)}${entry.existingPuc ? `  → ${entry.existingPuc}` : ''}${entry.reason ? `\n      ${entry.reason}` : ''}`);
      }
    }

    const results: Array<{ entry: ComboPlanEntry; createdPuc?: string; error?: string }> = [];
    if (options.apply) {
      const { ProductService } = await import('../src/services/product.service.js');
      const service = new ProductService();
      console.log('');
      for (const entry of count('CREATE')) {
        try {
          // Amazon stock row only: a nivapp row would list the combo on the Nivaana website
          const product: any = await service.create(entry.input as any, { platforms: ['amazon'] });
          results.push({ entry, createdPuc: product.puc });
          console.log(`  ✔ ${product.puc}  ${line(entry)}`);
        } catch (error: any) {
          results.push({ entry, error: error?.message ?? String(error) });
          console.log(`  ✘ ${line(entry)}\n      ${error?.message ?? error}`);
        }
      }
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const out = path.join(outputDir, `amazon-combos-${options.env}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(out, JSON.stringify({
      environment: options.env, database: db, file: path.relative(backendRoot, options.file), applied: options.apply, plan, results,
    }, (_key, value) => (typeof value === 'bigint' ? String(value) : value), 2));
    const created = results.filter((result) => result.createdPuc).length;
    const failed = results.filter((result) => result.error).length;
    console.log(`\n${options.apply ? `Created ${created}, failed ${failed}` : `Dry run only — add --apply --confirm=${CONFIRMATION} to create`}. Log: ${path.relative(backendRoot, out)}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
