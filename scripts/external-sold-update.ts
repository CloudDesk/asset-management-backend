/**
 * External Sold Update Script
 * ============================================================
 * Use this script to manually mark stock as sold for units
 * sold on external platforms (Amazon, Flipkart, etc.)
 * that are not captured through the normal order flow.
 *
 * Updates 3 tables atomically per row:
 *   1. product        → soldquantity++, availablequantity--, productstatus recalculated
 *   2. platformstock  → soldqty++, availableqty--, platformstatus recalculated
 *   3. stock          → stockstatus='sold', solddate, description (oldest N units FIFO)
 *
 * ── HOW TO RUN ─────────────────────────────────────────────
 *   STEP 1 — Dry run (read-only, shows before → after, NO writes):
 *     npm run sold:update
 *
 *   STEP 2 — Live run (shows preview again, then asks "yes" to confirm):
 *     DRY_RUN=false npm run sold:update
 * ============================================================
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 🔌 DB CONNECTION
//
//   Option A — pass individual params (recommended for prod):
//     DB_HOST=xxx DB_PORT=5432 DB_USER=postgres DB_PASSWORD=xxx DB_NAME=assetmanagement_prod
//
//   Option B — falls back to DATABASE_URL in .env (dev default)
//
//   The script builds the URL internally — you never type a raw postgres:// string.

// ============================================================
function resolveDbUrl(): string {
    const host = "centerbeam.proxy.rlwy.net";
    const port = "34305";
    const user = "postgres";
    const password = "zPjXkWvnHzvaVonPhQRYQitsWXpITBbp";
    const dbName = "railway";

    if (host && user && password && dbName) {
        // Encode password in case it has special characters
        const encodedPassword = encodeURIComponent(password);
        return `postgresql://${user}:${encodedPassword}@${host}:${port}/${dbName}`;
    }

    // Fall back to .env DATABASE_URL
    const fallback = process.env.DATABASE_URL;
    if (!fallback) {
        console.error('❌  No DB connection info found. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME — or DATABASE_URL in .env');
        process.exit(1);
    }
    return fallback;
}

const DB_URL = resolveDbUrl();

const prisma = new PrismaClient({
    datasources: { db: { url: DB_URL } },
});

// ============================================================
// 🔒 DRY_RUN FLAG
//    true  (default) → reads DB, prints preview, NO writes
//    false           → reads DB, prints preview, asks "yes/no", then writes
// ============================================================
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: true (dry run). Set DRY_RUN=false for live run. // for window powershel use $env:DRY_RUN="false"; npm run sold:update

// ============================================================
// FIXED DESCRIPTION — applied to every stock row in this batch
// ============================================================
const SOLD_DESCRIPTION = `Manually updated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} based on Excel sheet shared`;

// ============================================================
// INPUT DATA
//
//   id       : product id  (number)
//   quantity : units sold  (number)
//   platform : any case   → lowercased automatically ('Amazon' → 'amazon')
//   solddate : date string in MM/DD/YYYY format
//              The script converts it to Feb 7 2026 10:00 AM UTC → 1770458400 (seconds)
// ============================================================
const SOLD_UPDATES: Array<{
    id: number;
    quantity: number;
    platform: string;
    solddate: string;   // 'MM/DD/YYYY'
}> =
    [
        // { id: ****, quantity: 2, platform: 'Amazon', solddate: '3/3/2026' }, 
   { id: 33, quantity: 2, platform: 'Amazon', solddate: '2/5/2026' },
{ id: 18, quantity: 2, platform: 'Flipkart', solddate: '2/5/2026' },
{ id: 23, quantity: 1, platform: 'Flipkart', solddate: '4/5/2026' },
{ id: 21, quantity: 1, platform: 'Flipkart', solddate: '4/5/2026' },
{ id: 39, quantity: 2, platform: 'Amazon', solddate: '4/5/2026' },
{ id: 21, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 20, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 22, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 19, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 18, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 23, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 18, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 21, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 23, quantity: 1, platform: 'Flipkart', solddate: '5/5/2026' },
{ id: 23, quantity: 1, platform: 'Flipkart', solddate: '6/5/2026' },
{ id: 18, quantity: 1, platform: 'Flipkart', solddate: '6/5/2026' },
{ id: 39, quantity: 1, platform: 'Flipkart', solddate: '6/5/2026' },
{ id: 33, quantity: 1, platform: 'Flipkart', solddate: '6/5/2026' },
{ id: 19, quantity: 1, platform: 'Flipkart', solddate: '7/5/2026' },
{ id: 18, quantity: 2, platform: 'Flipkart', solddate: '7/5/2026' },
{ id: 15, quantity: 2, platform: 'Amazon', solddate: '9/5/2026' },
{ id: 53, quantity: 1, platform: 'Amazon', solddate: '9/5/2026' },
{ id: 33, quantity: 2, platform: 'Amazon', solddate: '11/5/2026' },
{ id: 18, quantity: 2, platform: 'Flipkart', solddate: '11/5/2026' },
{ id: 18, quantity: 2, platform: 'Flipkart', solddate: '10/5/2026' },
{ id: 23, quantity: 1, platform: 'Flipkart', solddate: '12/5/2026' },
{ id: 21, quantity: 1, platform: 'Flipkart', solddate: '12/5/2026' },
{ id: 33, quantity: 2, platform: 'Amazon', solddate: '12/5/2026' },
{ id: 23, quantity: 1, platform: 'Amazon', solddate: '14/5/2026' },
{ id: 20, quantity: 1, platform: 'Amazon', solddate: '14/5/2026' },
{ id: 21, quantity: 2, platform: 'Amazon', solddate: '15/5/2026' },
{ id: 21, quantity: 1, platform: 'Flipkart', solddate: '14/5/2026' },
{ id: 23, quantity: 1, platform: 'Flipkart', solddate: '14/5/2026' },
{ id: 18, quantity: 1, platform: 'Flipkart', solddate: '14/5/2026' },
{ id: 18, quantity: 2, platform: 'Flipkart', solddate: '15/5/2026' },
{ id: 31, quantity: 1, platform: 'Amazon', solddate: '16/5/2026' },
{ id: 18, quantity: 2, platform: 'Flipkart', solddate: '16/5/2026' },
{ id: 40, quantity: 2, platform: 'Amazon', solddate: '17/5/2026' },
{ id: 40, quantity: 2, platform: 'Amazon', solddate: '18/5/2026' },
{ id: 13, quantity: 2, platform: 'Amazon', solddate: '20/5/2026' },
{ id: 22, quantity: 1, platform: 'Amazon', solddate: '20/5/2026' },
{ id: 23, quantity: 1, platform: 'Amazon', solddate: '20/5/2026' },
{ id: 31, quantity: 1, platform: 'Amazon', solddate: '22/5/2026' },
{ id: 18, quantity: 2, platform: 'Flipkart', solddate: '22/5/2026' },
{ id: 33, quantity: 2, platform: 'Flipkart', solddate: '23/5/2026' },
{ id: 19, quantity: 1, platform: 'Flipkart', solddate: '26/5/2026' },
{ id: 18, quantity: 1, platform: 'Flipkart', solddate: '26/5/2026' },
{ id: 13, quantity: 1, platform: 'Flipkart', solddate: '26/5/2026' },
{ id: 12, quantity: 1, platform: 'Flipkart', solddate: '26/5/2026' },
{ id: 10, quantity: 1, platform: 'Flipkart', solddate: '26/5/2026' },
{ id: 4, quantity: 1, platform: 'Amazon', solddate: '27/5/2026' },
{ id: 14, quantity: 1, platform: 'Amazon', solddate: '27/5/2026' },
{ id: 23, quantity: 1, platform: 'Amazon', solddate: '28/5/2026' },
{ id: 22, quantity: 1, platform: 'Amazon', solddate: '28/5/2026' },
    ]


// ============================================================
// DATE CONVERTER
//   Input  : 'MM/DD/YYYY'  e.g. '2/7/2026'
//   Output : BigInt epoch milliseconds at 10:00 AM UTC on that date
//            e.g. 1770458400000n  (= Feb 7 2026 10:00 AM UTC)
// ============================================================
function toSoldDateUTC(dateStr: string): bigint {
    const parts = dateStr.split('/');
    if (parts.length !== 3) throw new Error(`Invalid solddate format '${dateStr}' — expected MM/DD/YYYY`);
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    // Always 10:00 AM UTC (matches the external platform export convention)
    const d = new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
    return BigInt(d.getTime()); // epoch milliseconds (13 digits)
}

// ============================================================
// STATUS CALCULATOR
// ============================================================
function calcStatus(qty: number): string {
    if (qty <= 0) return 'out_of_stock';
    if (qty <= 5) return 'low_stock';
    return 'in_stock';
}

// ============================================================
// TYPES
// ============================================================
type Entry = (typeof SOLD_UPDATES)[0];

type Preview =
    | {
        ok: true;
        entry: Entry;
        platform: string;
        soldDateEpoch: bigint;   // converted from entry.solddate string → epoch milliseconds (13-digit)
        soldDateHuman: string;   // human-readable UTC string for preview display
        // current product values
        cur_prod_sold: number;
        cur_prod_avail: number;
        cur_prod_status: string | null;
        puc: string;
        // new product values
        new_prod_sold: number;
        new_prod_avail: number;
        new_prod_status: string;
        // platformstock
        ps_id: bigint;
        cur_ps_avail: number;
        cur_ps_sold: number;
        cur_ps_status: string | null;
        new_ps_avail: number;
        new_ps_sold: number;
        new_ps_status: string;
        // stock unit ids to update
        stockIds: bigint[];
    }
    | { ok: false; entry: Entry; platform: string; reason: string };

// ============================================================
// RUNNING STATE
// TWO separate caches to handle both duplicate-product and cross-platform cases:
//
//   RunningProductState  — keyed by productId ONLY
//     Tracks product.availablequantity / soldquantity across ALL platforms.
//     Example: id=18 sold on amazon (380→378), then on flipkart → starts at 378, not 380.
//
//   RunningPlatformState — keyed by productId-platform
//     Tracks platformstock.availableqty / soldqty per individual platform.
//     Example: id=18-amazon and id=18-flipkart are tracked independently.
// ============================================================
type RunningProductState = {
    puc: string;
    prod_avail: number;
    prod_sold: number;
    prod_status: string | null;
};

type RunningPlatformState = {
    ps_id: bigint;
    ps_avail: number;
    ps_sold: number;
    ps_status: string | null;
};

// ============================================================
// PHASE 1 — BUILD PREVIEW (read-only)
// ============================================================
async function buildPreview(
    entry: Entry,
    productRunningState: Map<string, RunningProductState>,   // keyed by productId (shared across platforms)
    platformRunningState: Map<string, RunningPlatformState>, // keyed by productId-platform
    claimedStockIds: Set<bigint>                             // stock IDs claimed by earlier entries
): Promise<Preview> {
    const platform = entry.platform.toLowerCase();
    const productKey = `${entry.id}`;               // product qty is cross-platform
    const platformKey = `${entry.id}-${platform}`;   // platformstock is per-platform

    // Convert 'MM/DD/YYYY' string → epoch seconds BigInt
    let soldDateEpoch: bigint;
    try {
        soldDateEpoch = toSoldDateUTC(entry.solddate);
    } catch (e: any) {
        return { ok: false, entry, platform, reason: e.message };
    }
    const soldDateHuman = new Date(Number(soldDateEpoch)).toUTCString(); // epoch ms → human readable

    // --- PRODUCT: use cache if seen before (ANY platform), else fetch from DB ---
    let puc: string;
    let cur_prod_avail: number;
    let cur_prod_sold: number;
    let cur_prod_status: string | null;

    const productCached = productRunningState.get(productKey);
    if (productCached) {
        // product seen before (same or different platform) — use running values
        puc = productCached.puc;
        cur_prod_avail = productCached.prod_avail;
        cur_prod_sold = productCached.prod_sold;
        cur_prod_status = productCached.prod_status;
    } else {
        // first time seeing this product — fetch from DB
        const product = await prisma.product.findUnique({
            where: { id: BigInt(entry.id) },
            select: { puc: true, soldquantity: true, availablequantity: true, productstatus: true },
        });
        if (!product) {
            return { ok: false, entry, platform, reason: `Product id=${entry.id} not found.` };
        }
        puc = product.puc;
        cur_prod_avail = product.availablequantity ?? 0;
        cur_prod_sold = product.soldquantity ?? 0;
        cur_prod_status = product.productstatus ?? null;
    }

    // --- PLATFORMSTOCK: use cache if this (productId, platform) seen before, else fetch from DB ---
    let ps_id: bigint;
    let cur_ps_avail: number;
    let cur_ps_sold: number;
    let cur_ps_status: string | null;

    const platformCached = platformRunningState.get(platformKey);
    if (platformCached) {
        // same (productId, platform) seen before — use running values
        ps_id = platformCached.ps_id;
        cur_ps_avail = platformCached.ps_avail;
        cur_ps_sold = platformCached.ps_sold;
        cur_ps_status = platformCached.ps_status;
    } else {
        // first time seeing this (productId, platform) — fetch from DB
        const ps = await prisma.platformStock.findFirst({
            where: { productid: BigInt(entry.id), platform },
            select: { id: true, availableqty: true, soldqty: true, platformstatus: true },
        });
        if (!ps) {
            return {
                ok: false, entry, platform,
                reason: `PlatformStock not found for productid=${entry.id}, platform='${platform}'.`,
            };
        }
        ps_id = ps.id;
        cur_ps_avail = ps.availableqty ?? 0;
        cur_ps_sold = ps.soldqty ?? 0;
        cur_ps_status = ps.platformstatus ?? null;
    }

    // --- guards ---
    if (cur_prod_avail - entry.quantity < 0) {
        return {
            ok: false, entry, platform,
            reason: `product.availablequantity (${cur_prod_avail}) < requested qty (${entry.quantity}). Would go negative — skipped.`,
        };
    }
    if (cur_ps_avail - entry.quantity < 0) {
        return {
            ok: false, entry, platform,
            reason: `platformstock.availableqty (${cur_ps_avail}) < requested qty (${entry.quantity}). Would go negative — skipped.`,
        };
    }

    // --- stock units: oldest first (FIFO), excluding already-claimed IDs ---
    let stocks: { id: bigint }[];
    if (claimedStockIds.size === 0) {
        stocks = await prisma.$queryRaw<{ id: bigint }[]>`
          SELECT id FROM stock
          WHERE
            puc                       = ${puc}
            AND LOWER(platform)       = ${platform}
            AND LOWER(stockstatus)   != 'sold'
            AND (isdeleted  IS NULL OR isdeleted  = false)
            AND (isarchive  IS NULL OR isarchive  = false)
          ORDER BY createddate ASC
          LIMIT ${entry.quantity}
        `;
    } else {
        const excludedList = Array.from(claimedStockIds).join(',');
        stocks = await prisma.$queryRawUnsafe<{ id: bigint }[]>(`
          SELECT id FROM stock
          WHERE
            puc                       = $1
            AND LOWER(platform)       = $2
            AND LOWER(stockstatus)   != 'sold'
            AND (isdeleted  IS NULL OR isdeleted  = false)
            AND (isarchive  IS NULL OR isarchive  = false)
            AND id NOT IN (${excludedList})
          ORDER BY createddate ASC
          LIMIT $3
        `, puc, platform, entry.quantity);
    }

    if (stocks.length < entry.quantity) {
        return {
            ok: false, entry, platform,
            reason: `Only ${stocks.length} available stock unit(s) found for puc='${puc}', platform='${platform}', but ${entry.quantity} requested (after excluding ${claimedStockIds.size} already-claimed unit(s)).`,
        };
    }

    // --- calculate new values ---
    const new_prod_avail = cur_prod_avail - entry.quantity;
    const new_prod_sold = cur_prod_sold + entry.quantity;
    const new_prod_status = calcStatus(new_prod_avail);
    const new_ps_avail = cur_ps_avail - entry.quantity;
    const new_ps_sold = cur_ps_sold + entry.quantity;
    const new_ps_status = calcStatus(new_ps_avail);
    const stockIds = stocks.map((s) => s.id);

    // --- update product running state (cross-platform, keyed by productId only) ---
    productRunningState.set(productKey, {
        puc,
        prod_avail: new_prod_avail,
        prod_sold: new_prod_sold,
        prod_status: new_prod_status,
    });

    // --- update platform running state (per-platform, keyed by productId-platform) ---
    platformRunningState.set(platformKey, {
        ps_id,
        ps_avail: new_ps_avail,
        ps_sold: new_ps_sold,
        ps_status: new_ps_status,
    });

    // --- mark stock IDs as claimed so they won't be picked again ---
    stockIds.forEach((id) => claimedStockIds.add(id));

    return {
        ok: true,
        entry,
        platform,
        soldDateEpoch,
        soldDateHuman,
        puc,
        cur_prod_sold,
        cur_prod_avail,
        cur_prod_status,
        new_prod_sold,
        new_prod_avail,
        new_prod_status,
        ps_id,
        cur_ps_avail,
        cur_ps_sold,
        cur_ps_status,
        new_ps_avail,
        new_ps_sold,
        new_ps_status,
        stockIds,
    };
}

// ============================================================
// FORMAT ONE ROW PREVIEW  (returns lines array — printed AND saved to file)
// ============================================================
function formatPreview(p: Preview, idx: number, total: number): string[] {
    const bar = '─'.repeat(76);
    const lines: string[] = [];
    const out = (s: string) => lines.push(s);

    out(``);
    out(`┌─ [${idx + 1}/${total}]  productId=${p.entry.id}  |  platform='${p.platform}'  |  qty=${p.entry.quantity}`);

    if (!p.ok) {
        out(`│  ❌ WILL SKIP — ${p.reason}`);
        out(`└${bar}`);
        return lines;
    }

    out(`│`);
    out(`│  📦 PRODUCT  (id=${p.entry.id}, puc='${p.puc}')`);
    out(`│    availablequantity :  ${p.cur_prod_avail}  →  ${p.new_prod_avail}`);
    out(`│    soldquantity      :  ${p.cur_prod_sold}  →  ${p.new_prod_sold}`);
    out(`│    productstatus     :  '${p.cur_prod_status}'  →  '${p.new_prod_status}'`);
    out(`│`);
    out(`│  🏪 PLATFORMSTOCK  (productid=${p.entry.id}, platform='${p.platform}')`);
    out(`│    availableqty      :  ${p.cur_ps_avail}  →  ${p.new_ps_avail}`);
    out(`│    soldqty           :  ${p.cur_ps_sold}  →  ${p.new_ps_sold}`);
    out(`│    platformstatus    :  '${p.cur_ps_status}'  →  '${p.new_ps_status}'`);
    out(`│`);
    out(`│  📋 STOCK  (${p.stockIds.length} unit(s) → 'sold')`);
    out(`│    stock ids         :  [${p.stockIds.map(String).join(', ')}]`);
    out(`│    stockstatus       :  current value  →  'sold'`);
    out(`│    solddate input    :  '${p.entry.solddate}'  (MM/DD/YYYY)`);
    out(`│    solddate (UTC)    :  ${p.soldDateHuman}`);
    out(`│    solddate (epoch)  :  ${p.soldDateEpoch}  ms (13-digit)`);
    out(`│    description       :  '${SOLD_DESCRIPTION}'`);
    out(`└${bar}`);
    return lines;
}

function printPreview(p: Preview, idx: number, total: number): string[] {
    const lines = formatPreview(p, idx, total);
    lines.forEach((l) => console.log(l));
    return lines;
}

// ============================================================
// PHASE 2 — APPLY WRITES (inside a transaction per row)
// ============================================================
async function applyUpdate(p: Preview & { ok: true }) {
    const modifieddate = BigInt(Math.floor(Date.now() / 1000)); // epoch seconds
    const soldDateEpoch = p.soldDateEpoch;                      // already converted in buildPreview

    await prisma.$transaction(async (tx) => {
        // 1. product
        await tx.product.update({
            where: { id: BigInt(p.entry.id) },
            data: {
                soldquantity: p.new_prod_sold,
                availablequantity: p.new_prod_avail,
                productstatus: p.new_prod_status,
                modifieddate,
            },
        });

        // 2. platformstock
        await tx.platformStock.update({
            where: { id: p.ps_id },
            data: {
                availableqty: p.new_ps_avail,
                soldqty: p.new_ps_sold,
                platformstatus: p.new_ps_status,
                modifieddate,
            },
        });

        // 3. stock — raw SQL because `description` column was added via raw ALTER TABLE
        //    and is not yet reflected in the generated Prisma client types.
        for (const stockId of p.stockIds) {
            await tx.$executeRaw`
        UPDATE stock
        SET
          stockstatus  = 'sold',
          solddate     = ${soldDateEpoch},
          description  = ${SOLD_DESCRIPTION},
          modifieddate = ${modifieddate}
        WHERE id = ${stockId}
      `;
        }
    });
}

// ============================================================
// CONFIRMATION PROMPT
// ============================================================
function confirm(question: string): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === 'yes');
        });
    });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    const modeLabel = DRY_RUN
        ? '🧪 DRY RUN  — read-only, zero DB writes'
        : '🚨 LIVE RUN — will write to PRODUCTION DB';

    const line = '═'.repeat(80);

    // Extract DB host from resolved URL for display (credentials stay hidden)
    let dbHost = 'unknown';
    try {
        const match = DB_URL.match(/@([^:/]+)/);
        if (match) dbHost = match[1];
    } catch { }

    const header: string[] = [
        ``,
        line,
        `  External Sold Update  |  ${modeLabel}`,
        `  DB Host              :  ${dbHost}   <- confirm this is the right DB!`,
        `  Entries to process   :  ${SOLD_UPDATES.length}`,
        line,
    ];
    header.forEach((l) => console.log(l));

    // ── PHASE 1: read all previews ────────────────────────────
    console.log(`\n📋  Fetching current values from DB...\n`);

    const previews: Preview[] = [];
    const allPreviewLines: string[] = [...header, ``, `📋  Fetching current values from DB...`];

    // Shared state across all buildPreview calls
    // productRunningState: cross-platform (keyed by productId) — fixes duplicate on different platforms
    // platformRunningState: per-platform (keyed by productId-platform) — fixes same platform duplicates
    const productRunningState = new Map<string, RunningProductState>();
    const platformRunningState = new Map<string, RunningPlatformState>();
    const claimedStockIds = new Set<bigint>();

    for (let i = 0; i < SOLD_UPDATES.length; i++) {
        const p = await buildPreview(SOLD_UPDATES[i], productRunningState, platformRunningState, claimedStockIds);
        previews.push(p);
        const lines = printPreview(p, i, SOLD_UPDATES.length);
        allPreviewLines.push(...lines);
    }

    const eligible = previews.filter((p) => p.ok);
    const ineligible = previews.filter((p) => !p.ok);

    const summaryLines = [
        ``,
        `📊  Preview Summary`,
        `    ✅  Will process :  ${eligible.length} row(s)`,
        `    ❌  Will skip    :  ${ineligible.length} row(s)`,
    ];
    summaryLines.forEach((l) => console.log(l));
    allPreviewLines.push(...summaryLines);

    // ── DRY RUN: save to file and stop ───────────────────────
    if (DRY_RUN) {
        // Build timestamped filename
        const now = new Date();
        const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-03-03T19-31-06
        const logDir = path.join(process.cwd(), 'scripts', 'dryrun-logs');
        const logFile = path.join(logDir, `dryrun-${ts}.txt`);

        try {
            fs.mkdirSync(logDir, { recursive: true });
            fs.writeFileSync(logFile, allPreviewLines.join('\n'), 'utf8');
            console.log(`\n📄  Dry run saved to: scripts/dryrun-logs/dryrun-${ts}.txt`);
        } catch (e: any) {
            console.error(`\n⚠️  Could not save dry run file: ${e.message}`);
        }

        console.log(`\n⚠️   DRY RUN — no changes made to the database.`);
        console.log(`    Happy with the preview? To apply, run:`);
        console.log(`    DRY_RUN=false npm run sold:update\n`);
        await prisma.$disconnect();
        return;
    }

    if (eligible.length === 0) {
        console.log(`\n⚠️   Nothing eligible to process. Exiting.\n`);
        await prisma.$disconnect();
        return;
    }

    // ── LIVE RUN: confirmation gate ───────────────────────────
    console.log(`\n${line}`);
    console.log(`  ⚠️   PRODUCTION WRITE — review the preview above before confirming.`);
    console.log(`${line}`);

    const go = await confirm(
        `\n  Type exactly "yes" to apply ${eligible.length} update(s) to production, or anything else to abort: `
    );

    if (!go) {
        console.log(`\n🚫  Aborted — no changes were made.\n`);
        await prisma.$disconnect();
        return;
    }

    // ── PHASE 2: apply writes ─────────────────────────────────
    console.log(`\n✏️   Applying updates...\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const p of previews) {
        if (!p.ok) {
            console.log(`    ⏭️   Skipping productId=${p.entry.id} — ${p.reason}`);
            continue;
        }

        try {
            await applyUpdate(p);
            successCount++;
            console.log(
                `    ✅  productId=${p.entry.id} | platform='${p.platform}' | ` +
                `stock ids updated: [${p.stockIds.map(String).join(', ')}]`
            );
        } catch (err: any) {
            failureCount++;
            console.error(`    ❌  FAILED productId=${p.entry.id} — ${err?.message ?? err}`);
        }
    }

    console.log(`\n${line}`);
    console.log(`📊  Final Result`);
    console.log(`    ✅  Succeeded :  ${successCount}`);
    console.log(`    ❌  Failed    :  ${failureCount}`);
    console.log(`    ⏭️   Skipped  :  ${ineligible.length}`);
    console.log(`    📦  Total     :  ${SOLD_UPDATES.length}`);
    console.log(`${line}\n`);

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('Fatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
});
