import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
  AmazonListingPublishPersistence,
  AmazonPublishActor,
  AmazonPublishProduct,
  AmazonPublishScope,
  amazonListingPublishRepository,
} from '../repositories/amazon-listing-publish.repository.js';
import {
  AmazonCatalogItem,
  AmazonListingsReadClient,
  AmazonSpApiError,
  amazonProductionListingsClient,
} from './amazon-production-listings.client.js';
import {
  AmazonProductionWriteGuardService,
  amazonProductionWriteGuardService,
} from './amazon-production-write-guard.service.js';
import { normalizeAmazonListing } from './amazon-listing-normalizer.js';
import { env } from '../config/env.js';

type DraftBootstrapInput = AmazonPublishScope & {
  productId: string;
  listingMode: 'UNDECIDED' | 'MAP_EXISTING' | 'OFFER_ONLY' | 'FULL_CATALOG';
  actor: AmazonPublishActor;
};

const ACTIVE_ENVIRONMENT = 'PRODUCTION';

export class AmazonListingPublishDraftError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
    this.name = 'AmazonListingPublishDraftError';
  }
}

const jsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

type CandidateResults = {
  catalog: Array<Record<string, unknown>>;
  productTypes: Array<Record<string, unknown>>;
  productTypeVersion?: string | null;
  attributeContract?: {
    editorVersion?: number;
    productType: string;
    requirements: string;
    schemaVersion: string | null;
    schemaChecksum: string;
    fields: Array<Record<string, unknown>>;
    groups: Array<Record<string, unknown>>;
  };
  mappedListing?: Record<string, unknown>;
  eligibility?: Record<string, unknown>;
  validation?: Record<string, unknown>;
};

const candidateResults = (value: unknown): CandidateResults => {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return { catalog: Array.isArray(value) ? value as Array<Record<string, unknown>> : [], productTypes: [] };
  }
  const object = value as Record<string, unknown>;
  return {
    catalog: Array.isArray(object.catalog) ? object.catalog as Array<Record<string, unknown>> : [],
    productTypes: Array.isArray(object.productTypes) ? object.productTypes as Array<Record<string, unknown>> : [],
    ...(typeof object.productTypeVersion === 'string' || object.productTypeVersion === null
      ? { productTypeVersion: object.productTypeVersion as string | null }
      : {}),
    ...(object.attributeContract && typeof object.attributeContract === 'object'
      ? { attributeContract: object.attributeContract as NonNullable<CandidateResults['attributeContract']> }
      : {}),
    ...(object.mappedListing && typeof object.mappedListing === 'object'
      ? { mappedListing: object.mappedListing as Record<string, unknown> }
      : {}),
    ...(object.eligibility && typeof object.eligibility === 'object'
      ? { eligibility: object.eligibility as Record<string, unknown> }
      : {}),
    ...(object.validation && typeof object.validation === 'object'
      ? { validation: object.validation as Record<string, unknown> }
      : {}),
  };
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const payloadHash = (value: unknown) => createHash('sha256').update(stableJson(value)).digest('hex');

const hasValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
};

const validationPayload = (draft: any, schema: Record<string, any>, marketplaceId: string) => {
  const attributesSchema = schema.properties?.attributes
    ? resolveSchemaNode(schema, schema.properties.attributes)
    : schema;
  const allowed = new Set(Object.keys(attributesSchema.properties ?? {}));
  const mapped = draft.mappedAttributes && typeof draft.mappedAttributes === 'object'
    ? draft.mappedAttributes as Record<string, unknown>
    : {};
  const attributes = Object.fromEntries(
    Object.entries(mapped).filter(([name, value]) => allowed.has(name) && hasValue(value))
  );
  if (draft.listingMode === 'OFFER_ONLY' && draft.asin) {
    if (allowed.has('merchant_suggested_asin') && !attributes.merchant_suggested_asin) {
      attributes.merchant_suggested_asin = [{ value: draft.asin, marketplace_id: marketplaceId }];
    }
    if (allowed.has('condition_type') && !attributes.condition_type) {
      attributes.condition_type = [{ value: 'new_new', marketplace_id: marketplaceId }];
    }
  }
  return {
    productType: draft.productType as string,
    requirements: draft.requirements as 'LISTING' | 'LISTING_PRODUCT_ONLY' | 'LISTING_OFFER_ONLY',
    attributes,
  };
};

export const normalizeAmazonAjvErrors = (errors: any[] | null | undefined) => {
  const normalized = (errors ?? [])
    .filter((error) => error.keyword !== 'if')
    .map((error) => {
      const missing = typeof error.params?.missingProperty === 'string' ? error.params.missingProperty : null;
      const pathParts = String(error.instancePath ?? '').split('/').filter(Boolean);
      const pathName = pathParts[0] === 'attributes' ? pathParts[1] ?? null : pathParts[0] ?? null;
      return {
        field: pathName ?? missing,
        path: error.instancePath || '/',
        keyword: error.keyword,
        message: error.message ?? 'Invalid value',
        params: error.params ?? {},
      };
    });
  const seen = new Set<string>();
  return normalized.filter((error) => {
    const key = JSON.stringify([error.field, error.keyword, error.params]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mappedListingSummary = (listing: any) => ({
  listingId: String(listing.id),
  asin: listing.asin,
  sellerSku: listing.sellerSku,
  title: listing.title,
  productType: listing.productType,
  listingStatus: listing.listingStatus,
  fulfilmentChannel: listing.fulfilmentChannel,
  publishedQuantity: listing.publishedQuantity,
  price: listing.price?.toString?.() ?? listing.price ?? null,
  currency: listing.currency,
  amazonLastUpdatedAt: iso(listing.amazonLastUpdatedAt),
  mappedAt: iso(listing.mappedAt),
});

const resolveSchemaNode = (root: Record<string, any>, input: unknown): Record<string, any> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const node = input as Record<string, any>;
  if (typeof node.$ref === 'string' && node.$ref.startsWith('#/')) {
    const resolved = node.$ref.slice(2).split('/').reduce<any>(
      (current, part) => current?.[part.replace(/~1/g, '/').replace(/~0/g, '~')],
      root
    );
    return { ...resolveSchemaNode(root, resolved), ...node, $ref: undefined };
  }
  if (Array.isArray(node.allOf)) {
    return node.allOf.reduce<Record<string, any>>(
      (merged, item) => ({ ...merged, ...resolveSchemaNode(root, item) }),
      { ...node, allOf: undefined }
    );
  }
  return node;
};

const enumValuesFor = (root: Record<string, any>, property: Record<string, any>) => {
  const propertyNode = resolveSchemaNode(root, property);
  const itemNode = resolveSchemaNode(root, propertyNode.items);
  const valueNode = resolveSchemaNode(root, itemNode.properties?.value);
  const values = valueNode.enum ?? propertyNode.enum;
  return Array.isArray(values) ? values : [];
};

const selectorNames = new Set([
  'marketplace_id',
  'language_tag',
  'currency',
  'audience',
  'fulfillment_channel_code',
]);

const editorControlsFor = (
  root: Record<string, any>,
  input: unknown,
  path: Array<string | number> = [],
  required = false,
  depth = 0
): Array<Record<string, unknown>> => {
  if (depth > 5) return [];
  const node = resolveSchemaNode(root, input);
  const values = Array.isArray(node.enum) ? node.enum : [];
  if (values.length > 0 || ['string', 'number', 'integer', 'boolean'].includes(node.type)) {
    return [{
      path,
      label: node.title ?? String(path.at(-1) ?? 'Value').replace(/_/g, ' '),
      description: node.description ?? null,
      valueType: node.type ?? 'string',
      enumValues: values,
      required,
      format: node.format ?? null,
    }];
  }
  if (node.type === 'array' || node.items) {
    return editorControlsFor(root, node.items, [...path, 0], required, depth + 1);
  }
  const requiredNames = new Set<string>(Array.isArray(node.required) ? node.required : []);
  return Object.entries(node.properties ?? {}).flatMap(([name, child]) => {
    if (path.length === 0 && selectorNames.has(name)) return [];
    return editorControlsFor(root, child, [...path, name], requiredNames.has(name), depth + 1);
  });
};

const friendlyAttributeLabel = (input: unknown, name: string) => {
  const candidate = typeof input === 'string' && input.trim() ? input.trim() : name;
  if (!/[_-]/.test(candidate) && !/^[a-z0-9 ]+$/.test(candidate)) return candidate;
  const acronyms: Record<string, string> = {
    asin: 'ASIN',
    gtin: 'GTIN',
    id: 'ID',
    sku: 'SKU',
    url: 'URL',
  };
  return candidate
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => acronyms[word.toLowerCase()] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
};

export const buildAmazonAttributeContract = (
  productType: string,
  requirements: string,
  schemaVersion: string | null,
  schemaChecksum: string,
  definitionSchema: Record<string, any>,
  propertyGroups: Record<string, any>
) => {
  const attributes = definitionSchema.properties?.attributes
    ? resolveSchemaNode(definitionSchema, definitionSchema.properties.attributes)
    : definitionSchema;
  const required = new Set<string>(Array.isArray(attributes.required) ? attributes.required : []);
  const groupByProperty = new Map<string, string>();
  const groups = Object.entries(propertyGroups ?? {}).map(([id, raw]) => {
    const group = raw && typeof raw === 'object' ? raw as Record<string, any> : {};
    const names = Array.isArray(group.propertyNames) ? group.propertyNames : [];
    names.forEach((name) => groupByProperty.set(String(name), id));
    return {
      id,
      title: group.title ?? id,
      description: group.description ?? null,
      propertyNames: names,
    };
  });
  const fields = Object.entries(attributes.properties ?? {}).map(([name, raw]) => {
    const property = resolveSchemaNode(definitionSchema, raw);
    const item = resolveSchemaNode(definitionSchema, property.items);
    const value = resolveSchemaNode(definitionSchema, item.properties?.value);
    return {
      name,
      label: friendlyAttributeLabel(property.title ?? property['x-displayName'], name),
      description: property.description ?? value.description ?? null,
      required: required.has(name),
      group: groupByProperty.get(name) ?? property['x-group'] ?? 'other',
      valueType: value.type ?? property.type ?? 'object',
      selectors: Object.keys(item.properties ?? {}).filter((key) => key !== 'value'),
      enumValues: enumValuesFor(definitionSchema, property),
      examples: property.examples ?? value.examples ?? [],
      minItems: property.minItems ?? property.minUniqueItems ?? null,
      maxItems: property.maxItems ?? property.maxUniqueItems ?? null,
      controls: editorControlsFor(definitionSchema, item),
    };
  }).sort((left, right) => Number(right.required) - Number(left.required) || String(left.label).localeCompare(String(right.label)));
  if (!groups.some((group) => group.id === 'other')) {
    groups.push({ id: 'other', title: 'Other attributes', description: null, propertyNames: [] });
  }
  return { editorVersion: 4, productType, requirements, schemaVersion, schemaChecksum, fields, groups };
};

const sourceSnapshot = (product: AmazonPublishProduct) => ({
  id: String(product.id),
  name: product.name,
  puc: product.puc,
  shortdescription: product.shortdescription,
  fulldescription: product.fulldescription,
  category: product.category,
  subcategory: product.subcategory,
  subsubcategory: product.subsubcategory,
  fragnancetype: product.fragnancetype,
  brand: product.brand,
  pack: product.pack,
  price: product.price?.toString() ?? null,
  availablequantity: product.availablequantity,
  productstatus: product.productstatus,
  material: product.material,
  manufacturer: product.manufacturer,
  netform: product.netform,
  netquantity: product.netquantity,
  numberofitems: product.numberofitems,
  itemlength: product.itemlength,
  itemthickness: product.itemthickness,
  images: {
    large: product.large,
    medium: product.medium,
    small: product.small,
  },
  modifieddate: product.modifieddate === null ? null : String(product.modifieddate),
});

const uniqueImages = (product: AmazonPublishProduct) =>
  [...new Set([...product.large, ...product.medium, ...product.small].filter((url) => url.trim().length > 0))];

const attribute = (value: unknown, marketplaceId: string, extra: Record<string, unknown> = {}) => [{
  value,
  marketplace_id: marketplaceId,
  ...extra,
}];

const mappedAttributes = (product: AmazonPublishProduct, marketplaceId: string) => {
  const images = uniqueImages(product);
  return {
    item_name: attribute(product.name, marketplaceId, { language_tag: 'en_IN' }),
    ...(product.brand ? { brand: attribute(product.brand, marketplaceId) } : {}),
    ...(product.fulldescription || product.shortdescription
      ? { product_description: attribute(product.fulldescription ?? product.shortdescription, marketplaceId, { language_tag: 'en_IN' }) }
      : {}),
    ...(product.manufacturer ? { manufacturer: attribute(product.manufacturer, marketplaceId) } : {}),
    ...(product.material ? { material: attribute(product.material, marketplaceId) } : {}),
    ...(product.numberofitems !== null ? { item_package_quantity: attribute(product.numberofitems, marketplaceId) } : {}),
    ...(product.price !== null ? {
      purchasable_offer: [{
        audience: 'ALL',
        currency: 'INR',
        marketplace_id: marketplaceId,
        our_price: [{ schedule: [{ value_with_tax: Number(product.price.toString()) }] }],
      }],
    } : {}),
    ...(product.availablequantity !== null ? {
      fulfillment_availability: [{
        fulfillment_channel_code: 'DEFAULT',
        quantity: product.availablequantity,
      }],
    } : {}),
    ...(images[0] ? {
      main_product_image_locator: [{
        media_location: images[0],
        marketplace_id: marketplaceId,
      }],
    } : {}),
    ...(images.length > 1 ? {
      other_product_image_locator: images.slice(1).map((mediaLocation) => ({
        media_location: mediaLocation,
        marketplace_id: marketplaceId,
      })),
    } : {}),
  };
};

const readiness = (product: AmazonPublishProduct) => {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!product.brand) missing.push('brand');
  if (product.price === null) missing.push('price');
  if (product.availablequantity === null) missing.push('availablequantity');
  if (!product.fulldescription && !product.shortdescription) missing.push('description');
  if (uniqueImages(product).length === 0) missing.push('images');
  if (!product.manufacturer) warnings.push('manufacturer');
  if (!product.category) warnings.push('category');
  if (!product.netquantity) warnings.push('netquantity');
  return {
    readyForAmazonSchema: missing.length === 0,
    missing,
    warnings,
    note: 'Amazon product-type validation can add more required fields after the product type is selected.',
  };
};

const legacySuggestedSellerSku = (product: AmazonPublishProduct) => {
  const normalized = product.puc
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `NIV-${normalized || String(product.id)}`.slice(0, 40);
};

const suggestedSellerSku = (product: AmazonPublishProduct) =>
  (product.puc.trim() || String(product.id)).slice(0, 40);

const iso = (value: Date | string | null | undefined) => {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : null;
};

const serializeAttempt = (attempt: any) => ({
  ...attempt,
  id: String(attempt.id),
  draftId: String(attempt.draftId),
  startedAt: iso(attempt.startedAt),
  finishedAt: iso(attempt.finishedAt),
  createdAt: iso(attempt.createdAt),
});

const serializeAudit = (audit: any) => ({
  ...audit,
  id: String(audit.id),
  draftId: String(audit.draftId),
  productId: String(audit.productId),
  createdAt: iso(audit.createdAt),
});

const serializeImage = (image: any) => ({
  ...image,
  id: String(image.id),
  draftId: String(image.draftId),
  accessibilityCheckedAt: iso(image.accessibilityCheckedAt),
  createdAt: iso(image.createdAt),
  updatedAt: iso(image.updatedAt),
});

const serializeDraft = (draft: any, product?: AmazonPublishProduct) => ({
  id: String(draft.id),
  productId: String(draft.productId),
  marketplace: draft.marketplace,
  environment: draft.environment,
  sellerId: draft.sellerId,
  marketplaceId: draft.marketplaceId,
  listingMode: draft.listingMode,
  sellerSku: draft.sellerSku,
  asin: draft.asin,
  productType: draft.productType,
  requirements: draft.requirements,
  fulfilmentChannel: draft.fulfilmentChannel,
  status: draft.status,
  lastValidationStatus: draft.lastValidationStatus,
  lastSubmissionStatus: draft.lastSubmissionStatus,
  draftRevision: draft.draftRevision,
  sourceProductModifiedAt: draft.sourceProductModifiedAt === null ? null : String(draft.sourceProductModifiedAt),
  sourceSnapshot: draft.sourceSnapshot,
  candidateResults: draft.candidateResults,
  mappedAttributes: draft.mappedAttributes,
  schemaVersion: draft.schemaVersion,
  schemaChecksum: draft.schemaChecksum,
  validatedPayloadHash: draft.validatedPayloadHash,
  createdAt: iso(draft.createdAt),
  updatedAt: iso(draft.updatedAt),
  cancelledAt: iso(draft.cancelledAt),
  images: Array.isArray(draft.images) ? draft.images.map(serializeImage) : [],
  attempts: Array.isArray(draft.attempts) ? draft.attempts.map(serializeAttempt) : [],
  audits: Array.isArray(draft.audits) ? draft.audits.map(serializeAudit) : [],
  ...(product ? {
    product: {
      id: String(product.id),
      puc: product.puc,
      name: product.name,
    },
    readiness: readiness(product),
  } : {}),
});

export class AmazonListingPublishDraftService {
  constructor(
    private readonly repository: AmazonListingPublishPersistence = amazonListingPublishRepository,
    private readonly amazonClient: AmazonListingsReadClient = amazonProductionListingsClient,
    private readonly writeGuard: Pick<AmazonProductionWriteGuardService, 'assertEnabled'> = amazonProductionWriteGuardService,
    private readonly publishFlags: {
      listingCreationEnabled: boolean;
      fullCatalogCreationEnabled: boolean;
    } = {
      listingCreationEnabled: env.AMAZON_LISTING_CREATION_ENABLED,
      fullCatalogCreationEnabled: env.AMAZON_FULL_CATALOG_CREATION_ENABLED,
    }
  ) {}

  private activeDraftKey(productId: string, scope: AmazonPublishScope) {
    return [ACTIVE_ENVIRONMENT, scope.sellerId, scope.marketplaceId, productId].join(':');
  }

  private async requireProduct(productId: string) {
    const product = await this.repository.getProduct(productId);
    if (!product) {
      throw new AmazonListingPublishDraftError(
        'Nivaana product not found',
        404,
        'NIVAANA_PRODUCT_NOT_FOUND'
      );
    }
    return product;
  }

  async bootstrap(input: DraftBootstrapInput) {
    const product = await this.requireProduct(input.productId);
    const mappedListing = await this.repository.getMappedListing(input.productId, input);
    const activeDraftKey = this.activeDraftKey(input.productId, input);
    let existing = await this.repository.getActiveDraft(activeDraftKey);
    if (existing) {
      if (mappedListing?.asin) {
        const candidates = candidateResults(existing.candidateResults);
        const mappedSummary = mappedListingSummary(mappedListing);
        const requiresReconciliation =
          existing.listingMode !== 'OFFER_ONLY'
          || existing.asin !== mappedListing.asin
          || existing.sellerSku !== mappedListing.sellerSku
          || existing.productType !== mappedListing.productType
          || candidates.mappedListing?.listingId !== mappedSummary.listingId;
        if (requiresReconciliation) {
          candidates.mappedListing = mappedSummary;
          delete candidates.attributeContract;
          const reconciled = await this.repository.transitionDraft({
            draftId: String(existing.id),
            draftRevision: existing.draftRevision,
            sellerId: input.sellerId,
            marketplaceId: input.marketplaceId,
            ...input.actor,
            operation: 'PUBLISH_DRAFT_RECONCILED_FROM_EXISTING_MAPPING',
            data: {
              status: 'MAPPED_OFFER_READY',
              listingMode: 'OFFER_ONLY',
              sellerSku: mappedListing.sellerSku,
              asin: mappedListing.asin,
              productType: mappedListing.productType ?? 'PRODUCT',
              requirements: 'LISTING_OFFER_ONLY',
              fulfilmentChannel: mappedListing.fulfilmentChannel,
              candidateResults: jsonValue(candidates),
            },
            metadata: jsonValue({ marketplaceListingId: String(mappedListing.id) }),
          });
          if (reconciled.status === 'UPDATED') existing = reconciled.draft;
          else if (reconciled.status === 'REVISION_CONFLICT') {
            const latest = await this.repository.getActiveDraft(activeDraftKey);
            if (latest) existing = latest;
          }
        }
      } else if (
        !existing.asin
        && existing.listingMode === 'UNDECIDED'
        && existing.sellerSku === legacySuggestedSellerSku(product)
        && existing.sellerSku !== suggestedSellerSku(product)
      ) {
        const refreshed = await this.repository.transitionDraft({
          draftId: String(existing.id),
          draftRevision: existing.draftRevision,
          sellerId: input.sellerId,
          marketplaceId: input.marketplaceId,
          ...input.actor,
          operation: 'PUBLISH_DRAFT_DEFAULT_SKU_REFRESHED',
          data: { sellerSku: suggestedSellerSku(product) },
          metadata: jsonValue({
            previousSellerSku: existing.sellerSku,
            source: 'NIVAANA_PUC',
          }),
        });
        if (refreshed.status === 'UPDATED') existing = refreshed.draft;
        else if (refreshed.status === 'REVISION_CONFLICT') {
          const latest = await this.repository.getActiveDraft(activeDraftKey);
          if (latest) existing = latest;
        }
      }
      const initialized = this.repository.ensureDraftImages
        ? await this.repository.ensureDraftImages(String(existing.id), uniqueImages(product), input.actor)
        : null;
      return {
        resumed: true,
        draft: serializeDraft(initialized ?? existing, product),
      };
    }

    try {
      const created = await this.repository.createDraft({
        productId: input.productId,
        activeDraftKey,
        sellerId: input.sellerId,
        marketplaceId: input.marketplaceId,
        listingMode: mappedListing?.asin ? 'OFFER_ONLY' : input.listingMode,
        sellerSku: mappedListing?.asin ? mappedListing.sellerSku : suggestedSellerSku(product),
        sourceProductModifiedAt: product.modifieddate,
        sourceSnapshot: jsonValue(sourceSnapshot(product)),
        mappedAttributes: jsonValue(mappedAttributes(product, input.marketplaceId)),
        ...(mappedListing?.asin ? {
          asin: mappedListing.asin,
          productType: mappedListing.productType ?? 'PRODUCT',
          requirements: 'LISTING_OFFER_ONLY',
          status: 'MAPPED_OFFER_READY',
          fulfilmentChannel: mappedListing.fulfilmentChannel,
          candidateResults: jsonValue({
            catalog: [],
            productTypes: [],
            mappedListing: mappedListingSummary(mappedListing),
          }),
        } : {}),
        actor: input.actor,
      });
      const initialized = this.repository.ensureDraftImages
        ? await this.repository.ensureDraftImages(String(created.id), uniqueImages(product), input.actor)
        : null;
      return {
        resumed: false,
        draft: serializeDraft(initialized ?? created, product),
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const racedDraft = await this.repository.getActiveDraft(activeDraftKey);
        if (racedDraft) {
          const initialized = this.repository.ensureDraftImages
            ? await this.repository.ensureDraftImages(String(racedDraft.id), uniqueImages(product), input.actor)
            : null;
          return {
            resumed: true,
            draft: serializeDraft(initialized ?? racedDraft, product),
          };
        }
      }
      throw error;
    }
  }

  async get(draftId: string, scope: AmazonPublishScope) {
    const draft = await this.repository.getDraft(draftId, scope);
    if (!draft) {
      throw new AmazonListingPublishDraftError(
        'Amazon publish draft not found',
        404,
        'AMAZON_PUBLISH_DRAFT_NOT_FOUND'
      );
    }
    const product = await this.repository.getProduct(String(draft.productId));
    return serializeDraft(draft, product ?? undefined);
  }

  async list(scope: AmazonPublishScope) {
    const [drafts, published] = await Promise.all([
      this.repository.listDrafts?.(scope) ?? [],
      this.repository.listPublishedProducts?.(scope) ?? [],
    ]);
    return {
      drafts: drafts.map((draft) => ({
        id: String(draft.id),
        productId: String(draft.productId),
        productName: draft.product?.name ?? null,
        productPuc: draft.product?.puc ?? null,
        sellerSku: draft.sellerSku,
        asin: draft.asin,
        productType: draft.productType,
        listingMode: draft.listingMode,
        status: draft.status,
        lastValidationStatus: draft.lastValidationStatus,
        lastSubmissionStatus: draft.lastSubmissionStatus,
        draftRevision: draft.draftRevision,
        imageUrl: draft.images?.[0]?.url ?? null,
        createdAt: iso(draft.createdAt),
        updatedAt: iso(draft.updatedAt),
      })),
      published: published.map((listing) => ({
        listingId: String(listing.id),
        productId: String(listing.productId),
        sellerSku: listing.sellerSku,
        asin: listing.asin,
        title: listing.title,
        listingStatus: listing.listingStatus,
        updatedAt: iso(listing.updatedAt),
      })),
    };
  }

  async cancel(
    draftId: string,
    input: { draftRevision: number; reason?: string },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const result = await this.repository.cancelDraft({
      draftId,
      draftRevision: input.draftRevision,
      ...(input.reason ? { reason: input.reason } : {}),
      ...scope,
      ...actor,
    });
    if (result.status === 'NOT_FOUND') {
      throw new AmazonListingPublishDraftError(
        'Amazon publish draft not found',
        404,
        'AMAZON_PUBLISH_DRAFT_NOT_FOUND'
      );
    }
    if (result.status === 'REVISION_CONFLICT') {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft changed; reload revision ${result.currentRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    if (result.status === 'NOT_CANCELLABLE') {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft cannot be cancelled while status is ${result.draftStatus}`,
        409,
        'AMAZON_PUBLISH_DRAFT_NOT_CANCELLABLE'
      );
    }
    return serializeDraft(result.draft);
  }

  async update(
    draftId: string,
    input: { draftRevision: number; listingMode?: string; sellerSku?: string; mappedAttributes?: Record<string, unknown> },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const result = await this.repository.updateDraft({
      draftId, draftRevision: input.draftRevision, ...scope, ...actor,
      ...(input.listingMode !== undefined ? { listingMode: input.listingMode } : {}),
      ...(input.sellerSku !== undefined ? { sellerSku: input.sellerSku } : {}),
      ...(input.mappedAttributes !== undefined ? { mappedAttributes: jsonValue(input.mappedAttributes) } : {}),
    });
    if (result.status === 'NOT_FOUND') throw new AmazonListingPublishDraftError('Amazon publish draft not found', 404, 'AMAZON_PUBLISH_DRAFT_NOT_FOUND');
    if (result.status === 'REVISION_CONFLICT') throw new AmazonListingPublishDraftError(`Amazon publish draft changed; reload revision ${result.currentRevision}`, 409, 'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT');
    if (result.status === 'NOT_EDITABLE') throw new AmazonListingPublishDraftError(`Amazon publish draft cannot be edited while status is ${result.draftStatus}`, 409, 'AMAZON_PUBLISH_DRAFT_NOT_EDITABLE');
    return serializeDraft(result.draft);
  }

  private async transition(
    draftId: string,
    draftRevision: number,
    scope: AmazonPublishScope,
    actor: AmazonPublishActor,
    operation: string,
    data: Parameters<AmazonListingPublishPersistence['transitionDraft']>[0]['data'],
    metadata?: Record<string, unknown>
  ) {
    const result = await this.repository.transitionDraft({
      draftId,
      draftRevision,
      ...scope,
      ...actor,
      operation,
      data,
      ...(metadata ? { metadata: jsonValue(metadata) } : {}),
    });
    if (result.status === 'NOT_FOUND') throw new AmazonListingPublishDraftError('Amazon publish draft not found', 404, 'AMAZON_PUBLISH_DRAFT_NOT_FOUND');
    if (result.status === 'REVISION_CONFLICT') throw new AmazonListingPublishDraftError(`Amazon publish draft changed; reload revision ${result.currentRevision}`, 409, 'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT');
    if (result.status === 'NOT_EDITABLE') throw new AmazonListingPublishDraftError(`Amazon publish draft cannot be edited while status is ${result.draftStatus}`, 409, 'AMAZON_PUBLISH_DRAFT_NOT_EDITABLE');
    return serializeDraft(result.draft);
  }

  private async requireDraft(draftId: string, scope: AmazonPublishScope) {
    const value = await this.repository.getDraft(draftId, scope);
    if (!value) throw new AmazonListingPublishDraftError('Amazon publish draft not found', 404, 'AMAZON_PUBLISH_DRAFT_NOT_FOUND');
    return value;
  }

  private async resolveProductTypeSchema(draft: any, scope: AmazonPublishScope) {
    if (!draft.productType || !draft.requirements) {
      throw new AmazonListingPublishDraftError('Select an Amazon product type first', 409, 'AMAZON_PRODUCT_TYPE_REQUIRED');
    }
    const requirements = draft.requirements as 'LISTING' | 'LISTING_PRODUCT_ONLY' | 'LISTING_OFFER_ONLY';
    const cacheKey = [
      scope.sellerId, scope.marketplaceId, draft.productType, requirements,
      'ENFORCED', 'en_IN', 'LATEST',
    ].join(':');
    let schema = this.repository.getProductTypeSchema
      ? await this.repository.getProductTypeSchema(cacheKey)
      : null;
    if (!schema) {
      if (!this.amazonClient.getProductTypeDefinition) {
        throw new AmazonListingPublishDraftError(
          'Amazon Product Type Definition retrieval is not configured',
          503,
          'AMAZON_PRODUCT_TYPE_DEFINITION_UNAVAILABLE'
        );
      }
      const definition = await this.amazonClient.getProductTypeDefinition({
        productType: draft.productType,
        requirements,
      });
      schema = {
        definitionSchema: definition.definitionSchema,
        propertyGroups: definition.propertyGroups ?? {},
        schemaChecksum: definition.schema.checksum,
        resolvedVersion: definition.productTypeVersion?.version ?? null,
      };
      if (this.repository.upsertProductTypeSchema) {
        await this.repository.upsertProductTypeSchema({
          cacheKey,
          sellerId: scope.sellerId,
          marketplaceId: scope.marketplaceId,
          productType: draft.productType,
          requirements,
          productTypeVersion: 'LATEST',
          resolvedVersion: schema.resolvedVersion,
          schemaChecksum: schema.schemaChecksum,
          definitionSchema: jsonValue(schema.definitionSchema),
          propertyGroups: jsonValue(schema.propertyGroups),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }
    }
    return schema;
  }

  async searchCatalog(
    draftId: string,
    input: {
      draftRevision: number;
      identifiers?: string[];
      identifiersType?: 'ASIN' | 'EAN' | 'GTIN' | 'ISBN' | 'JAN' | 'MINSAN' | 'SKU' | 'UPC';
      keywords?: string[];
    },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (!this.amazonClient.searchCatalogItems) {
      throw new AmazonListingPublishDraftError('Amazon catalog search is not configured', 503, 'AMAZON_CATALOG_SEARCH_UNAVAILABLE');
    }
    const snapshot = (draft.sourceSnapshot ?? {}) as Record<string, unknown>;
    const searchInput = input.identifiers?.length
      ? { identifiers: input.identifiers, identifiersType: input.identifiersType! }
      : {
          keywords: input.keywords?.length ? input.keywords : [String(snapshot.name ?? '').trim()].filter(Boolean),
          ...(snapshot.brand ? { brandNames: [String(snapshot.brand)] } : {}),
        };
    const items = await this.amazonClient.searchCatalogItems({ ...searchInput, pageSize: 10 });
    const normalized = items.map((item: AmazonCatalogItem) => {
      const summary = item.summaries?.find((value) => value.marketplaceId === scope.marketplaceId) ?? item.summaries?.[0];
      const images = item.images?.find((value) => value.marketplaceId === scope.marketplaceId)?.images ?? item.images?.[0]?.images;
      const productType = item.productTypes?.find((value) => value.marketplaceId === scope.marketplaceId)?.productType
        ?? item.productTypes?.[0]?.productType;
      return {
        asin: item.asin ?? null,
        title: summary?.itemName ?? null,
        brand: summary?.brand ?? null,
        manufacturer: summary?.manufacturer ?? null,
        image: images?.find((image) => image.variant === 'MAIN')?.link ?? images?.[0]?.link ?? null,
        productType: productType ?? null,
        identifiers: item.identifiers ?? [],
      };
    }).filter((item) => item.asin);
    const candidates = candidateResults(draft.candidateResults);
    candidates.catalog = normalized;
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_CATALOG_SEARCHED', {
      status: 'CATALOG_REVIEW_REQUIRED',
      candidateResults: jsonValue(candidates),
    }, {
      resultCount: normalized.length,
      searchMode: input.identifiers?.length ? 'IDENTIFIER' : 'KEYWORD',
    });
  }

  async selectAsin(
    draftId: string,
    input: { draftRevision: number; asin: string },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    const candidates = candidateResults(draft.candidateResults);
    const selected = candidates.catalog.find((value) => value.asin === input.asin);
    if (!selected) throw new AmazonListingPublishDraftError('Selected ASIN is not in the latest catalog results', 400, 'AMAZON_ASIN_NOT_IN_CANDIDATES');
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_ASIN_SELECTED', {
      status: 'ASIN_SELECTED',
      listingMode: 'OFFER_ONLY',
      asin: input.asin,
      productType: typeof selected.productType === 'string' ? selected.productType : 'PRODUCT',
      requirements: 'LISTING_OFFER_ONLY',
    }, { selectedAsin: input.asin });
  }

  async confirmNoCatalogMatch(
    draftId: string,
    input: { draftRevision: number; confirmed: true },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (draft.status !== 'CATALOG_REVIEW_REQUIRED') {
      throw new AmazonListingPublishDraftError('Search the Amazon catalog before confirming no match', 409, 'AMAZON_CATALOG_SEARCH_REQUIRED');
    }
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_NO_CATALOG_MATCH_CONFIRMED', {
      status: 'NO_ASIN_MATCH',
      listingMode: 'FULL_CATALOG',
      asin: null,
      productType: null,
      requirements: 'LISTING',
    });
  }

  async searchProductTypes(
    draftId: string,
    input: { draftRevision: number; itemName?: string; keywords?: string[] },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (draft.listingMode !== 'FULL_CATALOG') {
      throw new AmazonListingPublishDraftError('Product type search requires a full catalog draft', 409, 'AMAZON_FULL_CATALOG_DRAFT_REQUIRED');
    }
    if (!this.amazonClient.searchProductTypes) {
      throw new AmazonListingPublishDraftError('Amazon product type search is not configured', 503, 'AMAZON_PRODUCT_TYPE_SEARCH_UNAVAILABLE');
    }
    const snapshot = (draft.sourceSnapshot ?? {}) as Record<string, unknown>;
    const search = input.keywords?.length
      ? { keywords: input.keywords }
      : { itemName: input.itemName || String(snapshot.name ?? '').trim() };
    const result = await this.amazonClient.searchProductTypes(search);
    const candidates = candidateResults(draft.candidateResults);
    candidates.productTypes = result.productTypes;
    candidates.productTypeVersion = result.productTypeVersion;
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_PRODUCT_TYPES_SEARCHED', {
      status: 'PRODUCT_TYPE_REVIEW_REQUIRED',
      candidateResults: jsonValue(candidates),
    }, { resultCount: result.productTypes.length });
  }

  async selectProductType(
    draftId: string,
    input: { draftRevision: number; productType: string },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (draft.listingMode !== 'FULL_CATALOG') {
      throw new AmazonListingPublishDraftError('Product type selection requires a full catalog draft', 409, 'AMAZON_FULL_CATALOG_DRAFT_REQUIRED');
    }
    const candidates = candidateResults(draft.candidateResults);
    if (!candidates.productTypes.some((value) => value.name === input.productType)) {
      throw new AmazonListingPublishDraftError('Selected product type is not in the latest recommendations', 400, 'AMAZON_PRODUCT_TYPE_NOT_IN_CANDIDATES');
    }
    delete candidates.attributeContract;
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_PRODUCT_TYPE_SELECTED', {
      status: 'ATTRIBUTES_REQUIRED',
      listingMode: 'FULL_CATALOG',
      productType: input.productType,
      requirements: 'LISTING',
      candidateResults: jsonValue(candidates),
    }, { selectedProductType: input.productType });
  }

  async loadProductTypeDefinition(
    draftId: string,
    input: { draftRevision: number },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    const requirements = draft.requirements as 'LISTING' | 'LISTING_PRODUCT_ONLY' | 'LISTING_OFFER_ONLY';
    const schema = await this.resolveProductTypeSchema(draft, scope);
    const contract = buildAmazonAttributeContract(
      draft.productType,
      requirements,
      schema.resolvedVersion ?? null,
      schema.schemaChecksum,
      schema.definitionSchema as Record<string, any>,
      (schema.propertyGroups ?? {}) as Record<string, any>
    );
    const candidates = candidateResults(draft.candidateResults);
    candidates.attributeContract = contract;
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_PRODUCT_TYPE_DEFINITION_LOADED', {
      status: 'ATTRIBUTES_REQUIRED',
      candidateResults: jsonValue(candidates),
      schemaVersion: contract.schemaVersion,
      schemaChecksum: contract.schemaChecksum,
    }, { attributeCount: contract.fields.length, requiredCount: contract.fields.filter((field) => field.required).length });
  }

  async validateLocally(
    draftId: string,
    input: { draftRevision: number },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (draft.draftRevision !== input.draftRevision) {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft changed; reload revision ${draft.draftRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    const eligibility = candidateResults(draft.candidateResults).eligibility;
    if (eligibility?.blocking === true) {
      throw new AmazonListingPublishDraftError(
        'Resolve the Amazon listing restriction before validation',
        409,
        'AMAZON_LISTING_RESTRICTION_BLOCKED'
      );
    }
    if (draft.asin && eligibility?.status !== 'ELIGIBLE') {
      throw new AmazonListingPublishDraftError(
        'Check Amazon eligibility for this ASIN before validation',
        409,
        'AMAZON_ELIGIBILITY_CHECK_REQUIRED'
      );
    }
    if (!draft.asin && eligibility?.status !== 'NOT_CHECKABLE_PRE_ASIN') {
      throw new AmazonListingPublishDraftError(
        'Record the new-product eligibility limitation before validation',
        409,
        'AMAZON_ELIGIBILITY_CHECK_REQUIRED'
      );
    }
    if (draft.listingMode === 'FULL_CATALOG') {
      const activeImages = Array.isArray(draft.images)
        ? draft.images.filter((image: any) => image.status === 'ACTIVE')
        : [];
      if (activeImages.length === 0) {
        throw new AmazonListingPublishDraftError(
          'Add at least one Amazon draft image before validation',
          409,
          'AMAZON_DRAFT_IMAGE_REQUIRED'
        );
      }
      const unverifiedImages = activeImages.filter(
        (image: any) => image.accessibilityStatus !== 'VERIFIED'
      );
      if (unverifiedImages.length > 0) {
        throw new AmazonListingPublishDraftError(
          'Verify that every active Amazon draft image is publicly accessible before validation',
          409,
          'AMAZON_DRAFT_IMAGE_VERIFICATION_REQUIRED'
        );
      }
    }
    const schema = await this.resolveProductTypeSchema(draft, scope);
    const request = validationPayload(
      draft,
      schema.definitionSchema as Record<string, any>,
      scope.marketplaceId
    );
    const hash = payloadHash(request);
    const rootSchema = structuredClone(schema.definitionSchema) as Record<string, any>;
    delete rootSchema.$schema;
    const validatesWrapper = Boolean(rootSchema.properties?.attributes);
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      validateSchema: false,
      logger: false,
    });
    let valid = false;
    let errors: ReturnType<typeof normalizeAmazonAjvErrors> = [];
    try {
      const validate = ajv.compile(rootSchema);
      valid = Boolean(validate(validatesWrapper ? { attributes: request.attributes } : request.attributes));
      errors = normalizeAmazonAjvErrors(validate.errors);
    } catch (error) {
      throw new AmazonListingPublishDraftError(
        `Amazon product type schema could not be compiled: ${error instanceof Error ? error.message : 'unknown schema error'}`,
        502,
        'AMAZON_PRODUCT_TYPE_SCHEMA_INVALID'
      );
    }
    const candidates = candidateResults(draft.candidateResults);
    candidates.validation = {
      local: {
        status: valid ? 'VALID' : 'INVALID',
        checkedAt: new Date().toISOString(),
        payloadHash: hash,
        errors,
        attributeCount: Object.keys(request.attributes).length,
      },
    };
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_LOCAL_VALIDATION_COMPLETED', {
      status: valid ? 'LOCAL_VALIDATED' : 'VALIDATION_FAILED',
      candidateResults: jsonValue(candidates),
      lastValidationStatus: valid ? 'LOCAL_VALID' : 'LOCAL_INVALID',
      validatedPayloadHash: valid ? hash : null,
    }, {
      valid,
      errorCount: errors.length,
      payloadHash: hash,
      schemaChecksum: schema.schemaChecksum,
    });
  }

  async previewValidation(
    draftId: string,
    input: { draftRevision: number },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (draft.draftRevision !== input.draftRevision) {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft changed; reload revision ${draft.draftRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    if (!this.amazonClient.previewListingItem) {
      throw new AmazonListingPublishDraftError(
        'Amazon listing validation preview is not configured',
        503,
        'AMAZON_VALIDATION_PREVIEW_UNAVAILABLE'
      );
    }
    const schema = await this.resolveProductTypeSchema(draft, scope);
    const request = validationPayload(
      draft,
      schema.definitionSchema as Record<string, any>,
      scope.marketplaceId
    );
    const hash = payloadHash(request);
    const local = candidateResults(draft.candidateResults).validation?.local as Record<string, unknown> | undefined;
    if (draft.lastValidationStatus !== 'LOCAL_VALID' || draft.validatedPayloadHash !== hash || local?.status !== 'VALID') {
      throw new AmazonListingPublishDraftError(
        'Run local validation again before Amazon validation preview',
        409,
        'AMAZON_LOCAL_VALIDATION_REQUIRED'
      );
    }
    const requestKey = `VALIDATION_PREVIEW:${draftId}:${input.draftRevision}:${hash}`;
    let attempt = this.repository.getValidationAttempt
      ? await this.repository.getValidationAttempt(requestKey)
      : null;
    if (!attempt && this.repository.createValidationAttempt) {
      attempt = await this.repository.createValidationAttempt({
        draftId,
        operation: 'VALIDATION_PREVIEW',
        requestKey,
        draftRevision: input.draftRevision,
        payloadHash: hash,
        requestPayload: jsonValue(request),
        actor,
      });
    }
    let response: Awaited<ReturnType<NonNullable<AmazonListingsReadClient['previewListingItem']>>>;
    try {
      response = await this.amazonClient.previewListingItem({
        sellerSku: draft.sellerSku,
        productType: request.productType,
        requirements: request.requirements,
        attributes: request.attributes,
      });
    } catch (error) {
      if (attempt && this.repository.finishValidationAttempt) {
        await this.repository.finishValidationAttempt({
          attemptId: String(attempt.id),
          status: 'FAILED',
          issues: [],
          httpStatus: error instanceof AmazonSpApiError ? error.statusCode : null,
          errorCode: error instanceof AmazonSpApiError ? error.code : 'AMAZON_VALIDATION_PREVIEW_FAILED',
          errorMessage: error instanceof Error ? error.message : 'Amazon validation preview failed',
        });
      }
      throw error;
    }
    const hasErrors = response.issues.some((issue: any) =>
      String(issue?.severity ?? '').toUpperCase() === 'ERROR'
    );
    const valid = response.status === 'VALID' && !hasErrors;
    if (attempt && this.repository.finishValidationAttempt) {
      await this.repository.finishValidationAttempt({
        attemptId: String(attempt.id),
        status: valid ? 'SUCCEEDED' : 'REJECTED',
        responsePayload: jsonValue(response),
        amazonSubmissionId: response.submissionId,
        amazonStatus: response.status,
        issues: jsonValue(response.issues),
        httpStatus: 200,
      });
    }
    const candidates = candidateResults(draft.candidateResults);
    candidates.validation = {
      ...(candidates.validation ?? {}),
      amazon: {
        status: valid ? 'VALID' : 'INVALID',
        amazonStatus: response.status,
        checkedAt: new Date().toISOString(),
        payloadHash: hash,
        submissionId: response.submissionId,
        issues: response.issues,
        identifiers: response.identifiers,
      },
    };
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_VALIDATION_PREVIEW_COMPLETED', {
      status: valid ? 'AMAZON_VALIDATED' : 'VALIDATION_FAILED',
      candidateResults: jsonValue(candidates),
      lastValidationStatus: valid ? 'AMAZON_VALID' : 'AMAZON_INVALID',
      validatedPayloadHash: valid ? hash : null,
    }, {
      valid,
      issueCount: response.issues.length,
      payloadHash: hash,
      amazonStatus: response.status,
    });
  }

  async submit(
    draftId: string,
    input: {
      draftRevision: number;
      confirmed: true;
      confirmationText: string;
      idempotencyKey: string;
    },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (!draft.sellerSku || input.confirmationText !== draft.sellerSku) {
      throw new AmazonListingPublishDraftError(
        'Type the exact seller SKU to confirm this production publish',
        400,
        'AMAZON_PUBLISH_CONFIRMATION_MISMATCH'
      );
    }
    if (!this.repository.createValidationAttempt || !this.repository.getValidationAttempt
      || !this.repository.finishValidationAttempt || !this.repository.recordAcceptedSubmission) {
      throw new AmazonListingPublishDraftError(
        'Amazon listing submission persistence is not configured',
        503,
        'AMAZON_LISTING_SUBMISSION_PERSISTENCE_UNAVAILABLE'
      );
    }
    const requestKey = `PUBLISH:${draftId}:${input.idempotencyKey}`;
    const existingAttempt = await this.repository.getValidationAttempt(requestKey);
    if (existingAttempt) {
      if (existingAttempt.status === 'SUCCEEDED' && draft.status === 'SUBMITTED') {
        return this.get(draftId, scope);
      }
      throw new AmazonListingPublishDraftError(
        existingAttempt.status === 'STARTED'
          ? 'This publish request is already in progress or has an unknown outcome; reconcile it before retrying'
          : 'This publish request key was already used; start a fresh confirmed retry',
        409,
        existingAttempt.status === 'STARTED'
          ? 'AMAZON_SUBMISSION_OUTCOME_UNKNOWN'
          : 'AMAZON_PUBLISH_REQUEST_KEY_ALREADY_USED'
      );
    }
    if (draft.draftRevision !== input.draftRevision) {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft changed; reload revision ${draft.draftRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    if (!this.publishFlags.listingCreationEnabled) {
      throw new AmazonListingPublishDraftError(
        'Amazon listing creation is disabled by the dedicated backend feature switch',
        409,
        'AMAZON_LISTING_CREATION_DISABLED'
      );
    }
    if (draft.listingMode === 'FULL_CATALOG' && !this.publishFlags.fullCatalogCreationEnabled) {
      throw new AmazonListingPublishDraftError(
        'Amazon full-catalog product creation is disabled by the stricter backend feature switch',
        409,
        'AMAZON_FULL_CATALOG_CREATION_DISABLED'
      );
    }
    const currentProduct = await this.repository.getProduct(String(draft.productId));
    if (!currentProduct) {
      throw new AmazonListingPublishDraftError(
        'The source Nivaana product no longer exists',
        409,
        'NIVAANA_SOURCE_PRODUCT_MISSING'
      );
    }
    if (
      String(currentProduct.modifieddate ?? '') !== String(draft.sourceProductModifiedAt ?? '')
    ) {
      throw new AmazonListingPublishDraftError(
        'The Nivaana product changed after this Amazon draft was created; start a refreshed draft and validate again',
        409,
        'AMAZON_DRAFT_SOURCE_PRODUCT_STALE'
      );
    }
    const skuConflict = this.repository.findSellerSkuConflict
      ? await this.repository.findSellerSkuConflict(draftId, draft.sellerSku, scope)
      : null;
    if (skuConflict) {
      throw new AmazonListingPublishDraftError(
        `Seller SKU ${draft.sellerSku} is already used by another Amazon ${skuConflict.type.toLowerCase()}`,
        409,
        'AMAZON_SELLER_SKU_CONFLICT'
      );
    }
    if (draft.status !== 'AMAZON_VALIDATED' || draft.lastValidationStatus !== 'AMAZON_VALID') {
      throw new AmazonListingPublishDraftError(
        'The exact draft must pass Amazon validation preview before publishing',
        409,
        'AMAZON_VALIDATION_PREVIEW_REQUIRED'
      );
    }
    if (!this.amazonClient.submitListingItem) {
      throw new AmazonListingPublishDraftError(
        'Amazon listing submission is not configured',
        503,
        'AMAZON_LISTING_SUBMISSION_UNAVAILABLE'
      );
    }
    const schema = await this.resolveProductTypeSchema(draft, scope);
    if (draft.schemaChecksum && schema.schemaChecksum !== draft.schemaChecksum) {
      throw new AmazonListingPublishDraftError(
        'Amazon changed the product-type schema; reload attributes and validate again',
        409,
        'AMAZON_PRODUCT_TYPE_SCHEMA_CHANGED'
      );
    }
    const request = validationPayload(
      draft,
      schema.definitionSchema as Record<string, any>,
      scope.marketplaceId
    );
    const hash = payloadHash(request);
    const validation = candidateResults(draft.candidateResults).validation;
    const amazonValidation = validation?.amazon as Record<string, unknown> | undefined;
    const checkedAt = typeof amazonValidation?.checkedAt === 'string'
      ? new Date(amazonValidation.checkedAt).getTime()
      : Number.NaN;
    if (draft.validatedPayloadHash !== hash || amazonValidation?.status !== 'VALID'
      || amazonValidation?.payloadHash !== hash) {
      throw new AmazonListingPublishDraftError(
        'Draft values changed after validation; validate the exact payload again',
        409,
        'AMAZON_VALIDATION_PREVIEW_STALE'
      );
    }
    if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > 30 * 60 * 1000) {
      throw new AmazonListingPublishDraftError(
        'Amazon validation preview expired after 30 minutes; validate again',
        409,
        'AMAZON_VALIDATION_PREVIEW_EXPIRED'
      );
    }
    await this.writeGuard.assertEnabled(scope.sellerId, scope.marketplaceId);

    const attempt = await this.repository.createValidationAttempt({
      draftId,
      operation: 'PUBLISH',
      requestKey,
      draftRevision: input.draftRevision,
      payloadHash: hash,
      requestPayload: jsonValue(request),
      actor,
    });

    let response: Awaited<ReturnType<NonNullable<AmazonListingsReadClient['submitListingItem']>>>;
    try {
      response = await this.amazonClient.submitListingItem({
        sellerSku: draft.sellerSku,
        productType: request.productType,
        requirements: request.requirements,
        attributes: request.attributes,
      });
    } catch (error) {
      await this.repository.finishValidationAttempt({
        attemptId: String(attempt.id),
        status: 'FAILED',
        issues: [],
        httpStatus: error instanceof AmazonSpApiError ? error.statusCode : null,
        errorCode: error instanceof AmazonSpApiError ? error.code : 'AMAZON_LISTING_SUBMISSION_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Amazon listing submission failed',
      });
      throw error;
    }

    const hasErrors = response.issues.some((issue: any) =>
      String(issue?.severity ?? '').toUpperCase() === 'ERROR'
    );
    if (response.status !== 'ACCEPTED' || hasErrors || !response.submissionId) {
      await this.repository.finishValidationAttempt({
        attemptId: String(attempt.id),
        status: 'REJECTED',
        responsePayload: jsonValue(response),
        amazonSubmissionId: response.submissionId,
        amazonStatus: response.status,
        issues: jsonValue(response.issues),
        httpStatus: 200,
      });
      const candidates = candidateResults(draft.candidateResults);
      candidates.validation = {
        ...(candidates.validation ?? {}),
        amazon: {
          ...(amazonValidation ?? {}),
          status: 'INVALID',
          amazonStatus: response.status,
          checkedAt: new Date().toISOString(),
          payloadHash: hash,
          submissionId: response.submissionId,
          issues: response.issues,
        },
      };
      return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_LISTING_SUBMISSION_REJECTED', {
        status: 'VALIDATION_FAILED',
        candidateResults: jsonValue(candidates),
        lastValidationStatus: 'AMAZON_INVALID',
        lastSubmissionStatus: response.status,
        validatedPayloadHash: null,
      }, {
        amazonStatus: response.status,
        issueCount: response.issues.length,
      });
    }

    const candidates = candidateResults(draft.candidateResults);
    candidates.validation = {
      ...(candidates.validation ?? {}),
      submission: {
        status: 'ACCEPTED',
        submittedAt: new Date().toISOString(),
        submissionId: response.submissionId,
        payloadHash: hash,
        issues: response.issues,
        note: 'Amazon accepted the request for asynchronous processing. This does not yet mean the listing is live.',
      },
    };
    const recorded = await this.repository.recordAcceptedSubmission({
      draftId,
      draftRevision: input.draftRevision,
      attemptId: String(attempt.id),
      payloadHash: hash,
      amazonSubmissionId: response.submissionId,
      responsePayload: jsonValue(response),
      issues: jsonValue(response.issues),
      candidateResults: jsonValue(candidates),
      ...scope,
      ...actor,
    });
    if (recorded.status === 'NOT_FOUND') {
      throw new AmazonListingPublishDraftError('Amazon publish draft not found after submission', 404, 'AMAZON_PUBLISH_DRAFT_NOT_FOUND');
    }
    if (recorded.status === 'REVISION_CONFLICT') {
      throw new AmazonListingPublishDraftError(
        `Amazon accepted the submission but the draft changed locally; reconcile revision ${recorded.currentRevision}`,
        409,
        'AMAZON_SUBMISSION_RECORDED_WITH_REVISION_CONFLICT'
      );
    }
    if (recorded.status === 'NOT_READY') {
      throw new AmazonListingPublishDraftError(
        `Amazon accepted the submission but the draft is ${recorded.draftStatus}; manual reconciliation is required`,
        409,
        'AMAZON_SUBMISSION_REQUIRES_RECONCILIATION'
      );
    }
    return {
      ...serializeDraft(recorded.draft),
      marketplaceListingId: recorded.listingId,
    };
  }

  async reconcileSubmission(
    draftId: string,
    input: { draftRevision: number },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (draft.draftRevision !== input.draftRevision) {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft changed; reload revision ${draft.draftRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    if (draft.status === 'LIVE') return serializeDraft(draft);
    if (!['SUBMITTED', 'NEEDS_ATTENTION'].includes(draft.status)) {
      throw new AmazonListingPublishDraftError(
        `Draft status ${draft.status} cannot be reconciled`,
        409,
        'AMAZON_SUBMISSION_NOT_READY_FOR_RECONCILIATION'
      );
    }
    if (!draft.sellerSku || !this.amazonClient.fetchListing) {
      throw new AmazonListingPublishDraftError(
        'Amazon listing status retrieval is not configured',
        503,
        'AMAZON_LISTING_STATUS_UNAVAILABLE'
      );
    }
    if (!this.repository.recordSubmissionReconciliation) {
      throw new AmazonListingPublishDraftError(
        'Amazon listing reconciliation persistence is not configured',
        503,
        'AMAZON_LISTING_RECONCILIATION_PERSISTENCE_UNAVAILABLE'
      );
    }
    let raw;
    try {
      raw = await this.amazonClient.fetchListing(draft.sellerSku);
    } catch (error) {
      if (error instanceof AmazonSpApiError && error.statusCode === 404) {
        const candidates = candidateResults(draft.candidateResults);
        candidates.validation = {
          ...(candidates.validation ?? {}),
          reconciliation: {
            state: 'PROCESSING',
            checkedAt: new Date().toISOString(),
            listingStatus: 'NOT_AVAILABLE_YET',
            issues: [],
            note: 'Amazon accepted the submission but the listing is not available through Listings Items yet.',
          },
        };
        return {
          ...serializeDraft(draft),
          candidateResults: candidates,
        };
      }
      throw error;
    }
    const listing = normalizeAmazonListing(raw, {
      sellerId: scope.sellerId,
      marketplaceId: scope.marketplaceId,
    });
    const issues = raw.issues ?? [];
    const hasBlockingIssues = issues.some((issue) =>
      String(issue.severity ?? '').toUpperCase() === 'ERROR'
    );
    const statuses = listing.listingStatus.split(',').map((value) => value.trim().toUpperCase());
    const live = !hasBlockingIssues && statuses.some((status) =>
      status === 'BUYABLE' || status === 'DISCOVERABLE'
    );
    const state: 'PROCESSING' | 'LIVE' | 'NEEDS_ATTENTION' = hasBlockingIssues
      ? 'NEEDS_ATTENTION'
      : live ? 'LIVE' : 'PROCESSING';
    const candidates = candidateResults(draft.candidateResults);
    candidates.validation = {
      ...(candidates.validation ?? {}),
      reconciliation: {
        state,
        checkedAt: new Date().toISOString(),
        listingStatus: listing.listingStatus,
        asin: listing.asin,
        issues,
        note: state === 'LIVE'
          ? 'Amazon returned a discoverable or buyable listing without blocking issues.'
          : state === 'NEEDS_ATTENTION'
            ? 'Amazon returned blocking listing issues that must be corrected.'
            : 'Amazon has the listing, but it is not yet discoverable or buyable.',
      },
    };
    const recorded = await this.repository.recordSubmissionReconciliation({
      draftId,
      draftRevision: input.draftRevision,
      state,
      listing,
      issues: jsonValue(issues),
      candidateResults: jsonValue(candidates),
      ...scope,
      ...actor,
    });
    if (recorded.status === 'NOT_FOUND') {
      throw new AmazonListingPublishDraftError(
        'Pending Amazon listing mapping was not found',
        409,
        'AMAZON_PENDING_LISTING_MAPPING_NOT_FOUND'
      );
    }
    if (recorded.status === 'REVISION_CONFLICT') {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft changed; reload revision ${recorded.currentRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    if (recorded.status === 'NOT_SUBMITTED') {
      throw new AmazonListingPublishDraftError(
        `Draft status ${recorded.draftStatus} cannot be reconciled`,
        409,
        'AMAZON_SUBMISSION_NOT_READY_FOR_RECONCILIATION'
      );
    }
    return {
      ...serializeDraft(recorded.draft),
      marketplaceListingId: recorded.listingId,
    };
  }

  async reopenForCorrection(
    draftId: string,
    input: { draftRevision: number; confirmed: true; reason: string },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    if (draft.draftRevision !== input.draftRevision) {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft changed; reload revision ${draft.draftRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    if (draft.status !== 'NEEDS_ATTENTION') {
      throw new AmazonListingPublishDraftError(
        `Draft status ${draft.status} does not have blocking Amazon issues to correct`,
        409,
        'AMAZON_CORRECTION_NOT_AVAILABLE'
      );
    }
    if (!this.repository.reopenForCorrection) {
      throw new AmazonListingPublishDraftError(
        'Amazon correction workflow persistence is not configured',
        503,
        'AMAZON_CORRECTION_PERSISTENCE_UNAVAILABLE'
      );
    }
    const candidates = candidateResults(draft.candidateResults);
    const reconciliation = candidates.validation?.reconciliation as Record<string, unknown> | undefined;
    candidates.validation = {
      ...(candidates.validation ?? {}),
      correction: {
        status: 'OPEN',
        openedAt: new Date().toISOString(),
        reason: input.reason,
        issues: Array.isArray(reconciliation?.issues) ? reconciliation.issues : [],
        note: 'Correct the affected values, recheck eligibility, and run both validation gates before resubmitting.',
      },
    };
    delete candidates.eligibility;
    const result = await this.repository.reopenForCorrection({
      draftId,
      draftRevision: input.draftRevision,
      reason: input.reason,
      candidateResults: jsonValue(candidates),
      ...scope,
      ...actor,
    });
    if (result.status === 'NOT_FOUND') {
      throw new AmazonListingPublishDraftError('Amazon publish draft not found', 404, 'AMAZON_PUBLISH_DRAFT_NOT_FOUND');
    }
    if (result.status === 'REVISION_CONFLICT') {
      throw new AmazonListingPublishDraftError(
        `Amazon publish draft changed; reload revision ${result.currentRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    if (result.status === 'NOT_CORRECTABLE') {
      throw new AmazonListingPublishDraftError(
        `Draft status ${result.draftStatus} cannot be reopened for correction`,
        409,
        'AMAZON_CORRECTION_NOT_AVAILABLE'
      );
    }
    return serializeDraft(result.draft);
  }

  async checkEligibility(
    draftId: string,
    input: {
      draftRevision: number;
      conditionType: 'new_new' | 'new_open_box' | 'new_oem' | 'refurbished_refurbished'
        | 'used_like_new' | 'used_very_good' | 'used_good' | 'used_acceptable'
        | 'collectible_like_new' | 'collectible_very_good' | 'collectible_good'
        | 'collectible_acceptable' | 'club_club';
    },
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await this.requireDraft(draftId, scope);
    const candidates = candidateResults(draft.candidateResults);
    if (!draft.asin) {
      candidates.eligibility = {
        status: 'NOT_CHECKABLE_PRE_ASIN',
        checkedAt: new Date().toISOString(),
        asin: null,
        conditionType: input.conditionType,
        restrictions: [],
        blocking: false,
        approvalRequired: false,
        canProceedToValidation: true,
        canPublish: false,
        note: 'Amazon Listings Restrictions requires an ASIN. New catalogue eligibility remains unconfirmed until Amazon validation or submission.',
      };
      return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_ELIGIBILITY_DEFERRED_NO_ASIN', {
        candidateResults: jsonValue(candidates),
      }, { conditionType: input.conditionType });
    }
    if (!this.amazonClient.getListingsRestrictions) {
      throw new AmazonListingPublishDraftError('Amazon eligibility checking is not configured', 503, 'AMAZON_ELIGIBILITY_CHECK_UNAVAILABLE');
    }
    const restrictions = await this.amazonClient.getListingsRestrictions({
      asin: draft.asin,
      conditionType: input.conditionType,
    });
    const reasons = restrictions.flatMap((restriction) => restriction.reasons ?? []);
    const approvalRequired = reasons.some((reason) => reason.reasonCode === 'APPROVAL_REQUIRED');
    const blocking = restrictions.length > 0;
    const status = !blocking ? 'ELIGIBLE' : approvalRequired ? 'APPROVAL_REQUIRED' : 'RESTRICTED';
    candidates.eligibility = {
      status,
      checkedAt: new Date().toISOString(),
      asin: draft.asin,
      conditionType: input.conditionType,
      restrictions,
      blocking,
      approvalRequired,
      canProceedToValidation: !blocking,
      canPublish: !blocking,
      note: blocking
        ? 'Resolve the Amazon restriction before publishing.'
        : 'Amazon returned no listing restrictions for this ASIN and condition.',
    };
    return this.transition(draftId, input.draftRevision, scope, actor, 'AMAZON_ELIGIBILITY_CHECKED', {
      status: blocking ? 'RESTRICTION_BLOCKED' : 'ELIGIBILITY_CONFIRMED',
      candidateResults: jsonValue(candidates),
    }, {
      asin: draft.asin,
      conditionType: input.conditionType,
      eligibilityStatus: status,
      restrictionCount: restrictions.length,
    });
  }
}

export const amazonListingPublishDraftService = new AmazonListingPublishDraftService();
