import { prisma } from '../models/prisma.js';
import { buildComboProductInput, type ComboInputComponent } from '../utils/amazonComboPlan.js';
import { ValidationError } from '../utils/errorHandler.js';
import { AmazonListingMappingError, amazonListingMappingService } from './amazon-listing-mapping.service.js';
import { ProductService, type DefaultPlatform } from './product.service.js';

/**
 * "Map as combo" (AMZ-PLAN-27): an Amazon listing that sells several Nivaana products together is mapped
 * in one step. The combo with exactly these products and quantities is reused; otherwise it is created
 * (same rules as the product form, Amazon stock row only so it stays off the Nivaana website) and the
 * listing is mapped to it. Stock then comes from the products (FIX-2026-10-27-168).
 */

export type AmazonComboMappingInput = {
  listingId: string;
  components: Array<{ productId: string; requiredQty: number }>;
  unitsPerListing: number;
  allowRemap: boolean;
  sellerId: string;
  marketplaceId: string;
  requestedByUserId?: number;
  requestedByUserType?: string;
};

type Dependencies = {
  mapListing: typeof amazonListingMappingService.mapListing;
  createProduct: (input: Record<string, unknown>, options: { platforms: readonly DefaultPlatform[] }) => Promise<any>;
};

const fail = (message: string, statusCode: number, code: string): never => {
  throw new AmazonListingMappingError(message, statusCode, code);
};

/** Combo product (if any) whose active products and quantities are exactly `components` */
export async function findComboWithComponents(components: Array<{ productId: bigint; requiredQty: number }>) {
  const wanted = new Map(components.map((component) => [String(component.productId), component.requiredQty]));
  const touching = await prisma.productBundleMap.findMany({
    where: { componentproductid: { in: components.map((component) => component.productId) }, isactive: true, bundleproduct: { iscombo: true } },
    select: { bundleproductid: true },
  });
  const candidates = [...new Set(touching.map((row) => String(row.bundleproductid)))].map(BigInt);
  if (candidates.length === 0) return null;
  const rows = await prisma.productBundleMap.findMany({
    where: { bundleproductid: { in: candidates }, isactive: true },
    select: { bundleproductid: true, componentproductid: true, requiredqty: true },
  });
  for (const candidate of candidates) {
    const own = rows.filter((row) => row.bundleproductid === candidate);
    const same = own.length === wanted.size
      && own.every((row) => wanted.get(String(row.componentproductid)) === row.requiredqty);
    if (same) return prisma.product.findUnique({ where: { id: candidate }, select: { id: true, puc: true, name: true } });
  }
  return null;
}

export class AmazonComboMappingService {
  private readonly deps: Dependencies;

  constructor(deps: Partial<Dependencies> = {}) {
    this.deps = {
      mapListing: deps.mapListing ?? ((input) => amazonListingMappingService.mapListing(input)),
      createProduct: deps.createProduct ?? ((input, options) => new ProductService().create(input as any, options)),
    };
  }

  async mapAsCombo(input: AmazonComboMappingInput) {
    const ids = input.components.map((component) => component.productId);
    if (new Set(ids).size !== ids.length) fail('Each product can be added to the combo only once; raise its quantity instead', 400, 'AMAZON_COMBO_DUPLICATE_PRODUCT');
    if (ids.length < 2) fail('A combo needs at least 2 different products', 400, 'AMAZON_COMBO_TOO_FEW_PRODUCTS');

    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id: BigInt(input.listingId), marketplace: 'AMAZON', environment: 'PRODUCTION',
        sellerId: input.sellerId, marketplaceId: input.marketplaceId,
      },
      select: { id: true, productId: true, price: true, asin: true },
    });
    if (!listing) fail('Amazon production listing was not found', 404, 'AMAZON_LISTING_NOT_FOUND');

    // Raw SQL: some databases still have products without an HSN code, which the Prisma model cannot read
    const products = await prisma.$queryRawUnsafe<Array<ComboInputComponent & { hsn_code: string | null; gst_rate: string | null }>>(
      `SELECT id, puc, shortname, brand, category, subcategory, fragnancetype, hsn_code, gst_rate::text AS gst_rate, iscombo
         FROM product WHERE id = ANY($1::bigint[])`,
      ids,
    );
    const byId = new Map(products.map((product) => [String(product.id), product]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) fail(`Nivaana product ${missing.join(', ')} was not found`, 404, 'NIVAANA_PRODUCT_NOT_FOUND');
    const components = input.components.map((component) => ({
      ...byId.get(component.productId)!,
      hsn_code: byId.get(component.productId)!.hsn_code ?? '',
      gst_rate: byId.get(component.productId)!.gst_rate ?? '',
      requiredQty: component.requiredQty,
    }));

    let combo = await findComboWithComponents(components.map((component) => ({ productId: BigInt(component.id), requiredQty: component.requiredQty })));
    // Ask before replacing a mapping, and before creating anything for it
    if (listing!.productId !== null && !input.allowRemap && (!combo || listing!.productId !== combo.id)) {
      fail(`Listing is already mapped to product ${listing!.productId}; set allowRemap=true to replace it`, 409, 'AMAZON_LISTING_REMAP_CONFIRMATION_REQUIRED');
    }

    let created = false;
    if (!combo) {
      const built = buildComboProductInput({
        components,
        price: listing!.price === null ? null : Number(listing!.price),
        asin: listing!.asin,
        allowMixedTaxonomy: true,
      });
      if ('reason' in built) fail(built.reason, 409, 'AMAZON_COMBO_INVALID');
      try {
        const product = await this.deps.createProduct((built as { input: Record<string, unknown> }).input, { platforms: ['amazon'] });
        combo = { id: BigInt(product.id), puc: product.puc, name: product.name };
        created = true;
      } catch (error) {
        if (error instanceof ValidationError) fail(error.message, 409, 'AMAZON_COMBO_INVALID');
        throw error;
      }
    }

    const mapped = await this.deps.mapListing({
      listingId: input.listingId,
      productId: String(combo!.id),
      unitsPerListing: input.unitsPerListing,
      allowRemap: input.allowRemap,
      sellerId: input.sellerId,
      marketplaceId: input.marketplaceId,
      ...(input.requestedByUserId !== undefined ? { requestedByUserId: input.requestedByUserId } : {}),
      ...(input.requestedByUserType !== undefined ? { requestedByUserType: input.requestedByUserType } : {}),
    });
    return { listing: mapped, combo: { id: String(combo!.id), puc: combo!.puc, name: combo!.name, created } };
  }
}

export const amazonComboMappingService = new AmazonComboMappingService();
