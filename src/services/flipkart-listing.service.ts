import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import { buildCatalogWordStats, keyWords, scoreNameMatch, type CatalogWordStats } from '../utils/amazonProductMatch.js';
import {
  FlipkartListing,
  FlipkartListingState,
  FlipkartSellerApiClient,
  flipkartDataEnvironment,
  getFlipkartSellerApiClient,
} from './flipkart-api.client.js';

const SUGGESTION_MIN_SCORE = 25;
const SUGGESTION_CATALOG_LIMIT = 5000;
const SUGGESTION_LIMIT = 10;

// Flipkart FSN on the product equals the listing's product_id; case and spaces ignored
export const isSameFsn = (productFsn?: string | null, listingFsn?: string | null) => {
  const left = (productFsn ?? '').trim().toUpperCase();
  return left.length > 0 && left === (listingFsn ?? '').trim().toUpperCase();
};

// Items in one Flipkart listing from the SKU or title: "_Pack3", "_P3", "3Unit", "Pack of 3",
// "Set of 3" → 3; "_Single" → 1
const SKU_COUNT_PATTERNS = [/pack[\s_-]*(\d{1,3})(?!\d)/i, /set[\s_-]*(\d{1,2})(?!\d)/i, /(?:^|_)p(\d{1,2})(?!\d)/i, /unit[\s_-]*(\d{1,2})(?!\d)/i, /(?:^|_)(\d{1,2})[\s_-]*unit/i];
const TITLE_COUNT_PATTERNS = [/pack[\s_-]*of[\s_-]*(\d{1,3})(?!\d)/i, /set[\s_-]*of[\s_-]*(\d{1,3})(?!\d)/i];
export const flipkartPackHint = (sku: string, title?: string | null): number | null => {
  for (const [text, patterns] of [[sku, SKU_COUNT_PATTERNS], [title ?? '', TITLE_COUNT_PATTERNS]] as const) {
    for (const pattern of patterns) {
      const units = Number(text.match(pattern)?.[1] ?? 0);
      if (units >= 1) return units;
    }
  }
  return /(^|[\s_-])single($|[\s_-])/i.test(sku) ? 1 : null;
};

// Several different products in one listing ("Vanilla, Vanilla, Jungle Vibe … Pack of 3",
// "…Combo"): "Pack3" then counts products, not units of one product (decision D4: map as combo).
// A list in the title alone is not enough ("Aroma Oil, Diffuser, Refill (10 ml)" is one product).
export const flipkartLooksLikeCombo = (sku: string, title?: string | null) => {
  if (/combo/i.test(`${sku} ${title ?? ''}`)) return true;
  if ((flipkartPackHint(sku, title) ?? 1) < 2) return false;
  const head = (title ?? '').split('|')[0]!.replace(/\([^)]*\)/g, ' ');
  return /[,&+]/.test(head);
};

type ComboCandidate = { id: string; puc: string; name: string };

// Products of a combo listing from its title list: "Auora Vanilla, Vanilla, Jungle Vibe Blocks …" →
// 2 × Vanilla + 1 × Jungle Vibe. Each name is matched to the best-covered candidate; numbers in the
// title ("30 Units") help pick the 30-stick product over the 10-stick one. Unmatched names are returned.
export const proposeFlipkartCombo = (title: string, candidates: ComboCandidate[], stats: CatalogWordStats) => {
  const head = title.split('|')[0]!.replace(/\([^)]*\)/g, ' ');
  const numbers = (title.match(/\b\d+\b/g) ?? []);
  const picks = new Map<string, { product: ComboCandidate; quantity: number }>();
  const unmatched: string[] = [];
  for (const segment of head.split(/[,&+]/).map((part) => part.trim()).filter(Boolean)) {
    const words = new Set([...keyWords(segment, stats), ...numbers]);
    let best: { product: ComboCandidate; score: number } | null = null;
    for (const product of candidates) {
      const match = scoreNameMatch(product.name, words, stats);
      if (!match.matched.some((word) => !/^\d+$/.test(word))) continue;
      if (!best || match.score > best.score || (match.score === best.score && product.name.length < best.product.name.length)) {
        best = { product, score: match.score };
      }
    }
    if (!best) { unmatched.push(segment); continue; }
    const current = picks.get(best.product.id);
    picks.set(best.product.id, { product: best.product, quantity: (current?.quantity ?? 0) + 1 });
  }
  const components = [...picks.values()];
  return { components, unmatched, itemCount: components.reduce((sum, item) => sum + item.quantity, 0) };
};

// A RUNNING job older than this is treated as interrupted and does not block a new import
const IMPORT_STALE_AFTER_MS = 15 * 60 * 1000;
// Listings saved at the same time within one search batch
const IMPORT_WRITE_CONCURRENCY = 5;

const forEachLimit = async <T>(items: T[], limit: number, work: (item: T) => Promise<void>) => {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++]!);
  }));
};

// Safety stop: 100 batches of 20 = 2,000 listings per state
const MAX_PAGES_PER_STATE = 100;

const IMPORT_STATES: FlipkartListingState[] = [
  'ACTIVE', 'INACTIVE', 'READY_FOR_ACTIVATION', 'INACTIVATED_BY_FLIPKART', 'ARCHIVED',
];

export class FlipkartListingError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly code = 'FLIPKART_LISTING_ERROR') {
    super(message);
    this.name = 'FlipkartListingError';
  }
}

export const normalizeFlipkartListing = (listing: FlipkartListing, environment: 'MOCK' | 'PRODUCTION' = 'MOCK') => ({
  marketplace: 'FLIPKART',
  environment,
  marketplaceId: 'IN',
  sellerId: listing.sellerId.trim(),
  sellerSku: listing.sku.trim(),
  title: listing.productName.trim(),
  productType: listing.vertical.trim() || null,
  listingStatus: listing.status,
  // FBF stock sits in a Flipkart warehouse (decision D1); everything else is shipped by us
  fulfilmentChannel: listing.fulfilmentProfile === 'FBF' ? 'FLIPKART' : 'SELLER',
  publishedQuantity: listing.locations.reduce((total, location) => total + Math.max(0, Math.trunc(location.inventory)), 0),
  price: listing.sellingPrice.toFixed(2),
  currency: 'INR',
});

type Actor = { userId?: number; userType?: string };

export class FlipkartListingService {
  constructor(private readonly client: FlipkartSellerApiClient = getFlipkartSellerApiClient()) {}

  async importMockListings(actor: Actor = {}) {
    if (this.client.mode !== 'MOCK') {
      throw new FlipkartListingError('Pre-approval listing imports are restricted to mock mode', 409, 'FLIPKART_MOCK_MODE_REQUIRED');
    }
    return this.importListings(actor);
  }

  // Reads every listing state from Flipkart (mock or live) and stores listings, prices and
  // per-location stock. Read only: nothing is sent to Flipkart (FKT-PLAN-02).
  async importListings(actor: Actor = {}) {
    const environment = this.client.mode === 'MOCK' ? 'MOCK' : 'PRODUCTION';
    // Close runs a stopped server left RUNNING, so history never shows a run that will not finish
    await prisma.flipkartImportJob.updateMany({
      where: { environment, resourceType: 'LISTINGS', status: 'RUNNING', startedAt: { lte: new Date(Date.now() - IMPORT_STALE_AFTER_MS) } },
      data: { status: 'FAILED', errorCode: 'INTERRUPTED', errorMessage: 'Import stopped before it finished (server stopped or restarted)', finishedAt: new Date() },
    });
    const running = await prisma.flipkartImportJob.findFirst({
      where: { environment, resourceType: 'LISTINGS', status: 'RUNNING', startedAt: { gt: new Date(Date.now() - IMPORT_STALE_AFTER_MS) } },
      select: { id: true },
    });
    if (running) throw new FlipkartListingError('A Flipkart listing import is already running', 409, 'FLIPKART_IMPORT_RUNNING');

    const connection = environment === 'MOCK'
      ? await prisma.flipkartConnection.upsert({
        where: { environment_connectionType: { environment: 'MOCK', connectionType: 'SELF_ACCESS' } },
        create: { environment: 'MOCK', status: 'SIMULATED', sellerId: 'MOCK-NIVAANA-SELLER' },
        update: { status: 'SIMULATED', sellerId: 'MOCK-NIVAANA-SELLER' },
      })
      : await prisma.flipkartConnection.upsert({
        where: { environment_connectionType: { environment: env.FLIPKART_ENVIRONMENT, connectionType: 'SELF_ACCESS' } },
        create: { environment: env.FLIPKART_ENVIRONMENT, status: 'CONNECTED' },
        update: {},
      });
    const job = await prisma.flipkartImportJob.create({
      data: {
        connectionId: connection.id,
        environment,
        mode: environment,
        status: 'RUNNING',
        startedAt: new Date(),
        ...(actor.userId !== undefined ? { requestedByUserId: actor.userId } : {}),
        ...(actor.userType ? { requestedByUserType: actor.userType } : {}),
      },
    });

    let fetched = 0;
    let created = 0;
    let updated = 0;
    let pagesProcessed = 0;
    let sellerId: string | null = null;
    const sellerLocationIds = new Map<string, bigint>();
    try {
      for (const state of IMPORT_STATES) {
        let page = 0;
        do {
          const result = await this.client.searchListings({ state, page });
          pagesProcessed += 1;
          const items = result.items.filter((raw) => raw.sellerId && raw.sku);
          sellerId ??= items[0]?.sellerId ?? null;
          // One lookup per page instead of per listing (the database can be ~300 ms away)
          const existingSkus = new Set((await prisma.marketplaceListing.findMany({
            where: { marketplace: 'FLIPKART', marketplaceId: 'IN', sellerId: { in: [...new Set(items.map((raw) => raw.sellerId))] }, sellerSku: { in: items.map((raw) => raw.sku) } },
            select: { sellerId: true, sellerSku: true },
          })).map((row) => `${row.sellerId}|${row.sellerSku}`));
          for (const location of items.flatMap((raw) => raw.locations)) {
            if (sellerLocationIds.has(location.id)) continue;
            const sellerLocation = await prisma.flipkartSellerLocation.upsert({
              where: { connectionId_externalLocationId: { connectionId: connection.id, externalLocationId: location.id } },
              create: { connectionId: connection.id, externalLocationId: location.id, name: environment === 'MOCK' ? 'Mock Bengaluru Warehouse' : null, status: location.status, lastImportedAt: new Date() },
              update: { status: location.status, lastImportedAt: new Date() },
            });
            sellerLocationIds.set(location.id, sellerLocation.id);
          }

          await forEachLimit(items, IMPORT_WRITE_CONCURRENCY, async (raw) => {
            const normalized = normalizeFlipkartListing(raw, environment);
            const listing = await prisma.marketplaceListing.upsert({
              where: { marketplace_marketplaceId_sellerId_sellerSku: {
                marketplace: 'FLIPKART', marketplaceId: 'IN', sellerId: normalized.sellerId, sellerSku: normalized.sellerSku,
              } },
              create: normalized,
              update: { ...normalized, lastImportedAt: new Date() },
            });
            existingSkus.has(`${normalized.sellerId}|${normalized.sellerSku}`) ? updated += 1 : created += 1;
            fetched += 1;

            const detail = {
              flipkartListingId: raw.listingId,
              flipkartProductId: raw.productId,
              vertical: raw.vertical,
              mrp: raw.mrp,
              sellingPrice: raw.sellingPrice,
              rawPayload: (raw.raw ?? raw) as any,
            };
            await prisma.flipkartListingDetail.upsert({
              where: { listingId: listing.id },
              create: { listingId: listing.id, ...detail },
              update: detail,
            });

            for (const rawLocation of raw.locations) {
              const sellerLocationId = sellerLocationIds.get(rawLocation.id)!;
              await prisma.flipkartListingLocation.upsert({
                where: { listingId_externalLocationId: { listingId: listing.id, externalLocationId: rawLocation.id } },
                create: { listingId: listing.id, sellerLocationId, externalLocationId: rawLocation.id, status: rawLocation.status, publishedQuantity: rawLocation.inventory, lastImportedAt: new Date() },
                update: { sellerLocationId, status: rawLocation.status, publishedQuantity: rawLocation.inventory, lastImportedAt: new Date() },
              });
            }
          });
          if (!result.hasMore) break;
          page += 1;
        } while (page < MAX_PAGES_PER_STATE);
      }

      if (sellerId && environment === 'PRODUCTION') {
        await prisma.flipkartConnection.update({ where: { id: connection.id }, data: { sellerId } });
      }
      const unmapped = await prisma.marketplaceListing.count({ where: { marketplace: 'FLIPKART', environment, mappingStatus: { not: 'MAPPED' } } });
      const finished = await prisma.flipkartImportJob.update({
        where: { id: job.id },
        data: { status: 'SUCCESS', fetched, created, updated, unmapped, pagesProcessed, finishedAt: new Date() },
      });
      return this.serializeJob(finished);
    } catch (error) {
      await prisma.flipkartImportJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', fetched, created, updated, pagesProcessed, errorMessage: error instanceof Error ? error.message : 'Unknown import error', finishedAt: new Date() },
      });
      throw error;
    }
  }

  async list() {
    const listings = await prisma.marketplaceListing.findMany({
      where: { marketplace: 'FLIPKART', environment: flipkartDataEnvironment() },
      include: { flipkartDetail: { include: { locations: true } }, product: { select: { id: true, name: true, puc: true, fsn: true } } },
      orderBy: { sellerSku: 'asc' },
    });
    return listings.map((listing) => {
      const detail = listing.flipkartDetail;
      // rawPayload stays in the database (debugging); the screens get the fields they show
      const raw = (detail?.rawPayload ?? {}) as { details?: { fulfillment_profile?: string; tax?: { hsn?: string; tax_code?: string } } };
      return {
        ...listing, id: String(listing.id), productId: listing.productId ? String(listing.productId) : null,
        product: listing.product ? { ...listing.product, id: String(listing.product.id) } : null,
        fsn: detail?.flipkartProductId ?? null,
        fulfilmentProfile: raw.details?.fulfillment_profile ?? null,
        hsn: raw.details?.tax?.hsn ?? null,
        taxCode: raw.details?.tax?.tax_code ?? null,
        flipkartStock: detail ? detail.locations.reduce((total, location) => total + (location.publishedQuantity ?? 0), 0) : null,
        packHint: flipkartPackHint(listing.sellerSku, listing.title),
        comboHint: flipkartLooksLikeCombo(listing.sellerSku, listing.title),
        flipkartDetail: detail ? {
          listingId: String(detail.listingId), flipkartListingId: detail.flipkartListingId, flipkartProductId: detail.flipkartProductId,
          vertical: detail.vertical, mrp: detail.mrp, sellingPrice: detail.sellingPrice,
          locations: detail.locations.map((location) => ({ ...location, id: String(location.id), listingId: String(location.listingId), sellerLocationId: location.sellerLocationId ? String(location.sellerLocationId) : null })),
        } : null,
      };
    });
  }

  // Ranked Nivaana products for one Flipkart listing, same scoring idea as Amazon (FIX-126 / FIX-140)
  async suggestProducts(listingId: string) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: { id: BigInt(listingId), marketplace: 'FLIPKART', environment: flipkartDataEnvironment() },
      select: { sellerSku: true, title: true, productId: true, flipkartDetail: { select: { flipkartProductId: true } } },
    });
    if (!listing) throw new FlipkartListingError('Flipkart listing not found', 404, 'FLIPKART_LISTING_NOT_FOUND');
    const fsn = listing.flipkartDetail?.flipkartProductId ?? null;

    const relatedMappings = await prisma.marketplaceListing.findMany({
      where: {
        marketplace: 'FLIPKART', productId: { not: null },
        OR: [
          { sellerSku: { equals: listing.sellerSku, mode: 'insensitive' } },
          ...(fsn ? [{ flipkartDetail: { flipkartProductId: fsn } }] : []),
        ],
      },
      select: { productId: true },
      take: 20,
    });
    const historicalIds = new Set(relatedMappings.flatMap((item) => item.productId === null ? [] : [item.productId]));
    const products = await prisma.product.findMany({
      select: { id: true, puc: true, name: true, productstatus: true, fsn: true, iscombo: true, pack: true },
      orderBy: { id: 'asc' },
      take: SUGGESTION_CATALOG_LIMIT,
    });
    const stats = buildCatalogWordStats(products.map((product) => product.name));
    // SKUs join words with underscores (Nivaana_BlackOudh_Single): split camel case too
    const skuWords = listing.sellerSku.replace(/([a-z])([A-Z])/g, '$1 $2');
    const listingWords = keyWords(`${skuWords} ${listing.title ?? ''}`, stats);

    const suggestions = products.map((product) => {
      const reasons: string[] = [];
      let score = 0;
      if (product.id === listing.productId) { score += 100; reasons.push('Current mapping'); }
      if (isSameFsn(product.fsn, fsn)) { score += 90; reasons.push('Same FSN'); }
      if (product.puc.toLowerCase() === listing.sellerSku.toLowerCase()) { score += 80; reasons.push('Exact SKU and PUC match'); }
      if (historicalIds.has(product.id)) { score += 35; reasons.push('Previously mapped signal'); }
      const nameMatch = scoreNameMatch(product.name, listingWords, stats);
      if (nameMatch.score > 0) {
        score += nameMatch.score;
        reasons.push(`Name match ${nameMatch.matched.length}/${nameMatch.total}: ${nameMatch.matched.join(', ')}`);
      }
      return {
        product: { id: String(product.id), puc: product.puc, name: product.name, status: product.productstatus, fsn: product.fsn, iscombo: product.iscombo === true, pack: product.pack ?? null },
        score: Math.min(score, 100),
        confidence: score >= 80 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW',
        reasons,
      };
    })
      .filter((suggestion) => suggestion.score >= SUGGESTION_MIN_SCORE)
      .sort((left, right) => right.score - left.score || left.product.name.length - right.product.name.length);
    let comboHint = flipkartLooksLikeCombo(listing.sellerSku, listing.title);
    let packHint = flipkartPackHint(listing.sellerSku, listing.title);
    // Combo components come from single products only (a combo cannot contain a combo)
    const comboProposal = comboHint && listing.title
      ? proposeFlipkartCombo(listing.title, suggestions.filter((item) => !item.product.iscombo).map((item) => item.product), stats)
      : null;
    // "Jungle Vibe, Jungle Vibe, Jungle Vibe" names one product three times: a pack of 3, not a combo
    if (comboProposal && comboProposal.components.length === 1 && comboProposal.unmatched.length === 0) {
      comboHint = false;
      packHint = comboProposal.itemCount;
    }
    return {
      fsn, packHint, comboHint,
      comboProposal: comboHint && comboProposal && comboProposal.components.length >= 2 ? comboProposal : null,
      suggestions: suggestions.slice(0, SUGGESTION_LIMIT),
    };
  }

  async map(listingId: string, productId: string, unitsPerListing: number, actor: Actor = {}) {
    const [listing, product, platformStock] = await Promise.all([
      prisma.marketplaceListing.findFirst({ where: { id: BigInt(listingId), marketplace: 'FLIPKART' } }),
      prisma.product.findUnique({ where: { id: BigInt(productId) }, select: { id: true } }),
      prisma.platformStock.findUnique({ where: { productid_platform: { productid: BigInt(productId), platform: 'flipkart' } }, select: { id: true } }),
    ]);
    if (!listing) throw new FlipkartListingError('Flipkart listing not found', 404, 'FLIPKART_LISTING_NOT_FOUND');
    if (!product) throw new FlipkartListingError('Nivaana product not found', 404, 'PRODUCT_NOT_FOUND');
    if (!platformStock) throw new FlipkartListingError('Product has no Flipkart platform stock', 409, 'FLIPKART_PLATFORM_STOCK_MISSING');
    if (!Number.isInteger(unitsPerListing) || unitsPerListing < 1) throw new FlipkartListingError('unitsPerListing must be a positive integer');
    const beforeProductId = listing.productId;
    const updated = await prisma.$transaction(async (tx) => {
      const mappingChanged = listing.productId !== BigInt(productId) || listing.unitsPerListing !== unitsPerListing;
      const result = await tx.marketplaceListing.update({ where: { id: listing.id }, data: {
        productId: BigInt(productId), unitsPerListing, mappingStatus: 'MAPPED', mappedAt: new Date(),
        ...(mappingChanged ? { inventorySyncMode: 'DISABLED' } : {}),
      } });
      await tx.marketplaceListingAudit.create({ data: {
        listingId: listing.id, marketplace: 'FLIPKART', environment: listing.environment, marketplaceId: listing.marketplaceId,
        sellerId: listing.sellerId, sellerSku: listing.sellerSku, operation: 'MAP', changedFields: ['productId', 'unitsPerListing'],
        beforeValues: { productId: beforeProductId ? String(beforeProductId) : null, unitsPerListing: listing.unitsPerListing },
        afterValues: { productId, unitsPerListing, ...(mappingChanged ? { inventorySyncMode: 'DISABLED' } : {}) }, previousProductId: beforeProductId, productId: BigInt(productId),
        ...(actor.userId !== undefined ? { requestedByUserId: actor.userId } : {}), ...(actor.userType ? { requestedByUserType: actor.userType } : {}),
      } });
      return result;
    });
    return { id: String(updated.id), productId: String(updated.productId), unitsPerListing: updated.unitsPerListing, mappingStatus: updated.mappingStatus };
  }

  private serializeJob<T extends { id: bigint; connectionId: bigint | null }>(job: T) {
    return { ...job, id: String(job.id), connectionId: job.connectionId ? String(job.connectionId) : null };
  }
}

export const flipkartListingService = new FlipkartListingService();
