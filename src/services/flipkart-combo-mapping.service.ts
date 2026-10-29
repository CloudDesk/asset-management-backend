import { prisma } from '../models/prisma.js';
import { buildComboProductInput, type ComboInputComponent } from '../utils/amazonComboPlan.js';
import { ValidationError } from '../utils/errorHandler.js';
import { findComboWithComponents } from './amazon-combo-mapping.service.js';
import { flipkartDataEnvironment } from './flipkart-api.client.js';
import { FlipkartListingError, flipkartListingService } from './flipkart-listing.service.js';
import { ProductService, type DefaultPlatform } from './product.service.js';

/**
 * "Map as combo" for Flipkart (FKT-PLAN-02b, decision D4), same rules as Amazon (AMZ-PLAN-27 / FIX-171):
 * the combo with exactly these products and quantities is reused, otherwise it is created through the
 * product rules with a Flipkart stock row only (stays off the Nivaana website) and the listing's FSN.
 * A reused combo without a Flipkart stock row (e.g. made for Amazon) gets one. The listing is then
 * mapped to the combo with 1 unit per listing.
 */

export type FlipkartComboMappingInput = {
  listingId: string;
  components: Array<{ productId: string; requiredQty: number }>;
  allowRemap: boolean;
  actor?: { userId?: number; userType?: string };
};

type Dependencies = {
  mapListing: typeof flipkartListingService.map;
  createProduct: (input: Record<string, unknown>, options: { platforms: readonly DefaultPlatform[] }) => Promise<any>;
};

const fail = (message: string, statusCode: number, code: string): never => {
  throw new FlipkartListingError(message, statusCode, code);
};

export class FlipkartComboMappingService {
  private readonly deps: Dependencies;

  constructor(deps: Partial<Dependencies> = {}) {
    this.deps = {
      mapListing: deps.mapListing ?? ((...args) => flipkartListingService.map(...args)),
      createProduct: deps.createProduct ?? ((input, options) => new ProductService().create(input as any, options)),
    };
  }

  async mapAsCombo(input: FlipkartComboMappingInput) {
    const ids = input.components.map((component) => component.productId);
    if (new Set(ids).size !== ids.length) fail('Each product can be added to the combo only once; raise its quantity instead', 400, 'FLIPKART_COMBO_DUPLICATE_PRODUCT');
    if (ids.length < 2) fail('A combo needs at least 2 different products', 400, 'FLIPKART_COMBO_TOO_FEW_PRODUCTS');

    const listing = await prisma.marketplaceListing.findFirst({
      where: { id: BigInt(input.listingId), marketplace: 'FLIPKART', environment: flipkartDataEnvironment() },
      select: { id: true, productId: true, price: true, flipkartDetail: { select: { flipkartProductId: true } } },
    });
    if (!listing) fail('Flipkart listing not found', 404, 'FLIPKART_LISTING_NOT_FOUND');

    // Raw SQL: some databases still have products without an HSN code, which the Prisma model cannot read
    const products = await prisma.$queryRawUnsafe<Array<ComboInputComponent & { hsn_code: string | null; gst_rate: string | null }>>(
      `SELECT id, puc, shortname, brand, category, subcategory, fragnancetype, hsn_code, gst_rate::text AS gst_rate, iscombo
         FROM product WHERE id = ANY($1::bigint[])`,
      ids,
    );
    const byId = new Map(products.map((product) => [String(product.id), product]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) fail(`Nivaana product ${missing.join(', ')} was not found`, 404, 'PRODUCT_NOT_FOUND');
    const components = input.components.map((component) => ({
      ...byId.get(component.productId)!,
      hsn_code: byId.get(component.productId)!.hsn_code ?? '',
      gst_rate: byId.get(component.productId)!.gst_rate ?? '',
      requiredQty: component.requiredQty,
    }));

    let combo = await findComboWithComponents(components.map((component) => ({ productId: BigInt(component.id), requiredQty: component.requiredQty })));
    // Ask before replacing a mapping, and before creating anything for it
    if (listing!.productId !== null && !input.allowRemap && (!combo || listing!.productId !== combo.id)) {
      fail(`Listing is already mapped to product ${listing!.productId}; confirm to replace it`, 409, 'FLIPKART_LISTING_REMAP_CONFIRMATION_REQUIRED');
    }

    let created = false;
    if (!combo) {
      const built = buildComboProductInput({
        components,
        price: listing!.price === null ? null : Number(listing!.price),
        asin: null,
        fsn: listing!.flipkartDetail?.flipkartProductId ?? null,
        allowMixedTaxonomy: true,
      });
      if ('reason' in built) fail(built.reason, 409, 'FLIPKART_COMBO_INVALID');
      try {
        const product = await this.deps.createProduct((built as { input: Record<string, unknown> }).input, { platforms: ['flipkart'] });
        combo = { id: BigInt(product.id), puc: product.puc, name: product.name };
        created = true;
      } catch (error) {
        if (error instanceof ValidationError) fail(error.message, 409, 'FLIPKART_COMBO_INVALID');
        throw error;
      }
    } else {
      await ensureFlipkartStockRow(combo.id);
    }

    const mapped = await this.deps.mapListing(input.listingId, String(combo!.id), 1, input.actor ?? {});
    return { listing: mapped, combo: { id: String(combo!.id), puc: combo!.puc, name: combo!.name, created } };
  }
}

// Same defaults as ProductService.createDefaultPlatformStocks (nothing available until stock comes in)
export async function ensureFlipkartStockRow(productId: bigint) {
  const existing = await prisma.platformStock.findUnique({ where: { productid_platform: { productid: productId, platform: 'flipkart' } }, select: { id: true } });
  if (existing) return false;
  await prisma.platformStock.create({
    data: { productid: productId, platform: 'flipkart', availableqty: 0, orderedqty: 0, soldqty: 0, totalqty: 0, lockqty: 0, platformstatus: 'out_of_stock' },
  });
  return true;
}

export const flipkartComboMappingService = new FlipkartComboMappingService();
