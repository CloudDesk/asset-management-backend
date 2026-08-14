import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  AmazonListingPublishPersistence,
  AmazonPublishProduct,
  CancelAmazonPublishDraftInput,
  CancelAmazonPublishDraftResult,
  CreateAmazonPublishDraftInput,
  TransitionAmazonPublishDraftInput,
  UpdateAmazonPublishDraftInput,
} from '../repositories/amazon-listing-publish.repository.js';
import {
  amazonPublishDraftBootstrapSchema,
  amazonPublishDraftCancelSchema,
  amazonPublishDraftParamsSchema,
  amazonPublishDraftUpdateSchema,
  amazonPublishProductParamsSchema,
  amazonPublishSubmissionSchema,
  amazonPublishCorrectionSchema,
} from '../schemas/amazon-listing-publish.schema.js';
import {
  AmazonListingPublishDraftError,
  AmazonListingPublishDraftService,
  buildAmazonAttributeContract,
  normalizeAmazonAjvErrors,
} from './amazon-listing-publish-draft.service.js';

const SELLER_ID = 'TEST_SELLER';
const MARKETPLACE_ID = 'A21TJRUUN4KGV';

const product = (overrides: Partial<AmazonPublishProduct> = {}): AmazonPublishProduct => ({
  id: 42n,
  name: 'Nivaana First Rain Incense',
  puc: 'niv 0042',
  shortdescription: 'Short description',
  fulldescription: 'Complete product description',
  category: 'Incense',
  subcategory: null,
  subsubcategory: null,
  fragnancetype: 'Floral',
  large: ['https://storage.example/product-main.jpg'],
  medium: ['https://storage.example/product-main.jpg'],
  small: [],
  brand: 'Nivaana',
  pack: '20 sticks',
  price: new Prisma.Decimal('299.00'),
  availablequantity: 8,
  productstatus: 'Active',
  material: 'Bamboo',
  manufacturer: 'Nivaana',
  netform: 'Sticks',
  netquantity: '20 count',
  numberofitems: 1,
  itemlength: null,
  itemthickness: null,
  modifieddate: 1720000000000n,
  ...overrides,
});

const draft = (overrides: Record<string, unknown> = {}) => ({
  id: 100n,
  productId: 42n,
  marketplace: 'AMAZON',
  environment: 'PRODUCTION',
  sellerId: SELLER_ID,
  marketplaceId: MARKETPLACE_ID,
  listingMode: 'UNDECIDED',
  sellerSku: 'NIV-NIV-0042',
  asin: null,
  productType: null,
  requirements: null,
  fulfilmentChannel: 'UNKNOWN',
  status: 'DRAFT',
  lastValidationStatus: null,
  lastSubmissionStatus: null,
  draftRevision: 1,
  sourceProductModifiedAt: 1720000000000n,
  sourceSnapshot: {},
  candidateResults: [],
  mappedAttributes: {},
  schemaVersion: null,
  schemaChecksum: null,
  validatedPayloadHash: null,
  createdAt: new Date('2026-07-24T00:00:00.000Z'),
  updatedAt: new Date('2026-07-24T00:00:00.000Z'),
  cancelledAt: null,
  images: [{
    id: 501n,
    draftId: 100n,
    sourceType: 'NIVAANA_COPY',
    sourceProductUrl: 'https://storage.example/product-main.jpg',
    url: 'https://storage.example/product-main.jpg',
    sortOrder: 0,
    status: 'ACTIVE',
    accessibilityStatus: 'VERIFIED',
    accessibilityError: null,
    accessibilityCheckedAt: new Date('2026-07-24T00:00:00.000Z'),
    validationErrors: [],
    createdAt: new Date('2026-07-24T00:00:00.000Z'),
    updatedAt: new Date('2026-07-24T00:00:00.000Z'),
  }],
  attempts: [],
  audits: [],
  ...overrides,
});

class FakePublishRepository implements AmazonListingPublishPersistence {
  productResult: AmazonPublishProduct | null = product();
  activeDraftResult: any | null = null;
  activeDraftResults: any[] = [];
  draftListResult: any[] = [];
  publishedListResult: any[] = [];
  mappedListingResult: any | null = null;
  getDraftResult: any | null = draft();
  createInput: CreateAmazonPublishDraftInput | null = null;
  cancelInput: CancelAmazonPublishDraftInput | null = null;
  transitionInput: TransitionAmazonPublishDraftInput | null = null;
  transitionResult: any | null = null;
  schemaResult: any | null = null;
  attemptSequence = 900n;
  finishedAttempt: any | null = null;
  acceptedSubmissionInput: any | null = null;
  reconciliationInput: any | null = null;
  reopenCorrectionInput: any | null = null;
  skuConflictResult: { type: 'DRAFT' | 'LISTING'; id: string; productId: string } | null = null;
  cancelResult: CancelAmazonPublishDraftResult = {
    status: 'CANCELLED',
    draft: draft({ status: 'CANCELLED', draftRevision: 2 }),
  };

  async getProduct() {
    return this.productResult;
  }

  async findSellerSkuConflict() {
    return this.skuConflictResult;
  }

  async getActiveDraft() {
    if (this.activeDraftResults.length > 0) return this.activeDraftResults.shift();
    return this.activeDraftResult;
  }

  async listDrafts() {
    return this.draftListResult;
  }

  async listPublishedProducts() {
    return this.publishedListResult;
  }

  async getMappedListing() {
    return this.mappedListingResult;
  }

  async createDraft(input: CreateAmazonPublishDraftInput) {
    this.createInput = input;
    return draft({
      listingMode: input.listingMode,
      sellerSku: input.sellerSku,
      sourceSnapshot: input.sourceSnapshot,
      mappedAttributes: input.mappedAttributes,
    });
  }

  async getDraft() {
    return this.getDraftResult;
  }

  async getProductTypeSchema() {
    return this.schemaResult;
  }

  async getValidationAttempt() {
    return null;
  }

  async createValidationAttempt(input: any) {
    this.attemptSequence += 1n;
    return { id: this.attemptSequence, status: 'STARTED', ...input };
  }

  async finishValidationAttempt(input: any) {
    this.finishedAttempt = input;
    return input;
  }

  async recordAcceptedSubmission(input: any) {
    this.acceptedSubmissionInput = input;
    return {
      status: 'RECORDED' as const,
      listingId: '321',
      draft: draft({
        ...this.getDraftResult,
        status: 'SUBMITTED',
        lastSubmissionStatus: 'ACCEPTED',
        candidateResults: input.candidateResults,
        draftRevision: input.draftRevision + 1,
        createdAt: new Date('2026-07-24T00:00:00.000Z'),
        updatedAt: new Date('2026-07-24T00:00:00.000Z'),
        cancelledAt: null,
      }),
    };
  }

  async recordSubmissionReconciliation(input: any) {
    this.reconciliationInput = input;
    return {
      status: 'RECORDED' as const,
      listingId: '321',
      draft: draft({
        ...this.getDraftResult,
        status: input.state === 'LIVE' ? 'LIVE' : input.state === 'NEEDS_ATTENTION' ? 'NEEDS_ATTENTION' : 'SUBMITTED',
        lastSubmissionStatus: input.state,
        candidateResults: input.candidateResults,
        draftRevision: input.draftRevision + 1,
        createdAt: new Date('2026-07-24T00:00:00.000Z'),
        updatedAt: new Date('2026-07-24T00:00:00.000Z'),
        cancelledAt: null,
      }),
    };
  }

  async reopenForCorrection(input: any) {
    this.reopenCorrectionInput = input;
    return {
      status: 'REOPENED' as const,
      draft: draft({
        ...this.getDraftResult,
        status: 'ATTRIBUTES_REQUIRED',
        lastValidationStatus: null,
        validatedPayloadHash: null,
        candidateResults: input.candidateResults,
        draftRevision: input.draftRevision + 1,
        createdAt: new Date('2026-07-24T00:00:00.000Z'),
        updatedAt: new Date('2026-07-24T00:00:00.000Z'),
        cancelledAt: null,
      }),
    };
  }

  async updateDraft(input: UpdateAmazonPublishDraftInput) {
    return { status: 'UPDATED' as const, draft: draft({
      listingMode: input.listingMode ?? 'UNDECIDED',
      sellerSku: input.sellerSku ?? 'NIV-NIV-0042',
      mappedAttributes: input.mappedAttributes ?? {},
      draftRevision: input.draftRevision + 1,
    }) };
  }

  async transitionDraft(input: TransitionAmazonPublishDraftInput) {
    this.transitionInput = input;
    if (this.transitionResult) return this.transitionResult;
    return {
      status: 'UPDATED' as const,
      draft: draft({
        ...input.data,
        candidateResults: input.data.candidateResults ?? this.getDraftResult?.candidateResults ?? [],
        draftRevision: input.draftRevision + 1,
      }),
    };
  }

  async cancelDraft(input: CancelAmazonPublishDraftInput) {
    this.cancelInput = input;
    return this.cancelResult;
  }
}

const service = (repository: FakePublishRepository) =>
  new AmazonListingPublishDraftService(repository);

const discoveryService = (repository: FakePublishRepository) =>
  new AmazonListingPublishDraftService(repository, {
    getSellerId: () => SELLER_ID,
    getMarketplaceId: () => MARKETPLACE_ID,
    fetchListingsPage: async () => ({ items: [], nextToken: null }),
    fetchFbaInventoryPage: async () => ({ items: [], nextToken: null }),
    searchCatalogItems: async () => [{
      asin: 'B0ABC12345',
      summaries: [{ marketplaceId: MARKETPLACE_ID, itemName: 'First Rain Incense', brand: 'Nivaana' }],
      images: [{ marketplaceId: MARKETPLACE_ID, images: [{ variant: 'MAIN', link: 'https://amazon.example/main.jpg' }] }],
      productTypes: [{ marketplaceId: MARKETPLACE_ID, productType: 'INCENSE' }],
    }],
    searchProductTypes: async () => ({
      productTypes: [{ name: 'INCENSE', displayName: 'Incense', marketplaceIds: [MARKETPLACE_ID] }],
      productTypeVersion: 'v1',
    }),
    getListingsRestrictions: async () => [],
  });

const scope = {
  sellerId: SELLER_ID,
  marketplaceId: MARKETPLACE_ID,
};

test('creates a resumable draft prefilled from the Nivaana product without an Amazon call', async () => {
  const repository = new FakePublishRepository();
  const result = await service(repository).bootstrap({
    productId: '42',
    listingMode: 'UNDECIDED',
    ...scope,
    actor: { requestedByUserId: 7, requestedByUserType: 'inventory' },
  });

  assert.equal(result.resumed, false);
  assert.equal(result.draft.sellerSku, 'niv 0042');
  assert.equal(result.draft.readiness.readyForAmazonSchema, true);
  assert.ok(repository.createInput);
  assert.equal(repository.createInput.activeDraftKey, `PRODUCTION:${SELLER_ID}:${MARKETPLACE_ID}:42`);
  assert.deepEqual(repository.createInput.actor, {
    requestedByUserId: 7,
    requestedByUserType: 'inventory',
  });
  const attributes = repository.createInput.mappedAttributes as Record<string, any>;
  assert.equal(attributes.item_name[0].value, 'Nivaana First Rain Incense');
  assert.equal(attributes.purchasable_offer[0].currency, 'INR');
  assert.equal(attributes.fulfillment_availability[0].quantity, 8);
  assert.equal(attributes.main_product_image_locator[0].media_location, 'https://storage.example/product-main.jpg');
  assert.equal(attributes.other_product_image_locator, undefined);
});

test('resumes the active scoped draft instead of creating a duplicate', async () => {
  const repository = new FakePublishRepository();
  repository.activeDraftResult = draft();
  const result = await service(repository).bootstrap({
    productId: '42',
    listingMode: 'FULL_CATALOG',
    ...scope,
    actor: {},
  });
  assert.equal(result.resumed, true);
  assert.equal(repository.createInput, null);
  assert.equal(result.draft.sellerSku, 'niv 0042');
  assert.equal(repository.transitionInput?.operation, 'PUBLISH_DRAFT_DEFAULT_SKU_REFRESHED');
});

test('reloads the corrected seller SKU when concurrent draft bootstrap wins the revision race', async () => {
  const repository = new FakePublishRepository();
  repository.activeDraftResults = [
    draft({ sellerSku: 'NIV-NIV-0042', draftRevision: 1 }),
    draft({ sellerSku: 'niv 0042', draftRevision: 2 }),
  ];
  repository.transitionResult = { status: 'REVISION_CONFLICT', currentRevision: 2 };

  const result = await service(repository).bootstrap({
    productId: '42',
    listingMode: 'UNDECIDED',
    ...scope,
    actor: {},
  });

  assert.equal(result.resumed, true);
  assert.equal(result.draft.sellerSku, 'niv 0042');
  assert.equal(result.draft.draftRevision, 2);
});

test('lists scoped publishing drafts and published product mappings', async () => {
  const repository = new FakePublishRepository();
  repository.draftListResult = [draft({
    product: { id: 42n, puc: 'NIV-0042', name: 'First Rains' },
    images: [{ url: 'https://storage.example/draft.jpg' }],
  })];
  repository.publishedListResult = [{
    id: 80n,
    productId: 42n,
    sellerSku: 'NIV-0042',
    asin: 'B0ABC12345',
    title: 'First Rains',
    listingStatus: 'DISCOVERABLE,BUYABLE',
    updatedAt: new Date('2026-07-24T00:00:00.000Z'),
  }];

  const result = await service(repository).list(scope);

  assert.equal(result.drafts[0]?.productName, 'First Rains');
  assert.equal(result.drafts[0]?.imageUrl, 'https://storage.example/draft.jpg');
  assert.equal(result.published[0]?.productId, '42');
  assert.equal(result.published[0]?.listingStatus, 'DISCOVERABLE,BUYABLE');
});

test('reconciles an existing draft from an authoritative mapped Amazon listing', async () => {
  const repository = new FakePublishRepository();
  repository.activeDraftResult = draft({ listingMode: 'FULL_CATALOG', asin: null, productType: 'INCENSE' });
  repository.mappedListingResult = {
    id: 83n,
    sellerSku: 'Nivaana_10Pack_First Rains',
    asin: 'B0GFD3FJKR',
    title: 'Nivaana First Rains Incense Sticks',
    productType: 'INCENSE',
    listingStatus: 'DISCOVERABLE,BUYABLE',
    fulfilmentChannel: 'UNKNOWN',
    publishedQuantity: 8,
    price: new Prisma.Decimal('70'),
    currency: 'INR',
    amazonLastUpdatedAt: new Date('2026-01-26T06:41:52.453Z'),
    mappedAt: new Date('2026-01-20T00:00:00.000Z'),
  };
  const result = await service(repository).bootstrap({
    productId: '42',
    listingMode: 'UNDECIDED',
    ...scope,
    actor: { requestedByUserId: 7 },
  });
  assert.equal(result.resumed, true);
  assert.equal(result.draft.listingMode, 'OFFER_ONLY');
  assert.equal(result.draft.asin, 'B0GFD3FJKR');
  assert.equal(result.draft.sellerSku, 'Nivaana_10Pack_First Rains');
  assert.equal(repository.transitionInput?.operation, 'PUBLISH_DRAFT_RECONCILED_FROM_EXISTING_MAPPING');
});

test('reports missing Nivaana readiness values without blocking draft creation', async () => {
  const repository = new FakePublishRepository();
  repository.productResult = product({
    brand: null,
    price: null,
    availablequantity: null,
    fulldescription: null,
    shortdescription: null,
    large: [],
    medium: [],
  });
  const result = await service(repository).bootstrap({
    productId: '42',
    listingMode: 'UNDECIDED',
    ...scope,
    actor: {},
  });
  assert.equal(result.draft.readiness.readyForAmazonSchema, false);
  assert.deepEqual(result.draft.readiness.missing, [
    'brand',
    'price',
    'availablequantity',
    'description',
    'images',
  ]);
});

test('returns a safe error for an unknown Nivaana product', async () => {
  const repository = new FakePublishRepository();
  repository.productResult = null;
  await assert.rejects(
    service(repository).bootstrap({
      productId: '999',
      listingMode: 'UNDECIDED',
      ...scope,
      actor: {},
    }),
    (error: unknown) => {
      assert.ok(error instanceof AmazonListingPublishDraftError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'NIVAANA_PRODUCT_NOT_FOUND');
      return true;
    }
  );
});

test('cancels a matching draft revision and passes the scoped actor to persistence', async () => {
  const repository = new FakePublishRepository();
  const result = await service(repository).cancel(
    '100',
    { draftRevision: 1, reason: 'User changed destination' },
    scope,
    { requestedByUserId: 7, requestedByUserType: 'inventory' }
  );
  assert.equal(result.status, 'CANCELLED');
  assert.deepEqual(repository.cancelInput, {
    draftId: '100',
    draftRevision: 1,
    reason: 'User changed destination',
    ...scope,
    requestedByUserId: 7,
    requestedByUserType: 'inventory',
  });
});

test('rejects cancellation when the draft revision is stale', async () => {
  const repository = new FakePublishRepository();
  repository.cancelResult = { status: 'REVISION_CONFLICT', currentRevision: 5 };
  await assert.rejects(
    service(repository).cancel('100', { draftRevision: 4 }, scope, {}),
    (error: unknown) => {
      assert.ok(error instanceof AmazonListingPublishDraftError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT');
      return true;
    }
  );
});

test('validates publish draft route contracts', () => {
  assert.deepEqual(amazonPublishProductParamsSchema.parse({ productId: 42 }), { productId: '42' });
  assert.deepEqual(amazonPublishDraftParamsSchema.parse({ draftId: '100' }), { draftId: '100' });
  assert.deepEqual(amazonPublishDraftBootstrapSchema.parse({}), { listingMode: 'UNDECIDED' });
  assert.deepEqual(amazonPublishDraftCancelSchema.parse({ draftRevision: 3 }), { draftRevision: 3 });
  assert.deepEqual(amazonPublishDraftUpdateSchema.parse({ draftRevision: 3, sellerSku: 'NIV-42' }), { draftRevision: 3, sellerSku: 'NIV-42' });
  assert.throws(() => amazonPublishProductParamsSchema.parse({ productId: '0' }));
  assert.throws(() => amazonPublishDraftCancelSchema.parse({ draftRevision: 0 }));
  assert.throws(() => amazonPublishDraftBootstrapSchema.parse({ listingMode: 'UNKNOWN' }));
  assert.throws(() => amazonPublishDraftUpdateSchema.parse({ draftRevision: 3 }));
  assert.deepEqual(amazonPublishSubmissionSchema.parse({
    draftRevision: 3,
    confirmed: true,
    confirmationText: 'SKU-1',
    idempotencyKey: 'f26f7938-e9f1-4e7d-94cc-3a8c7e0bca44',
  }), {
    draftRevision: 3,
    confirmed: true,
    confirmationText: 'SKU-1',
    idempotencyKey: 'f26f7938-e9f1-4e7d-94cc-3a8c7e0bca44',
  });
  assert.throws(() => amazonPublishSubmissionSchema.parse({
    draftRevision: 3,
    confirmed: false,
    confirmationText: 'SKU-1',
    idempotencyKey: 'f26f7938-e9f1-4e7d-94cc-3a8c7e0bca44',
  }));
  assert.deepEqual(amazonPublishCorrectionSchema.parse({
    draftRevision: 4,
    confirmed: true,
    reason: 'Correct the missing main image',
  }), {
    draftRevision: 4,
    confirmed: true,
    reason: 'Correct the missing main image',
  });
});

test('stores normalized Amazon catalog candidates without publishing', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({ sourceSnapshot: { name: 'First Rain Incense', brand: 'Nivaana' } });
  const result = await discoveryService(repository).searchCatalog(
    '100', { draftRevision: 1 }, scope, { requestedByUserId: 7 }
  );
  assert.equal(result.status, 'CATALOG_REVIEW_REQUIRED');
  assert.equal((result.candidateResults as any).catalog[0].asin, 'B0ABC12345');
  assert.equal(repository.transitionInput?.operation, 'AMAZON_CATALOG_SEARCHED');
});

test('rejects an ASIN that was not returned by the latest catalog search', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({ candidateResults: { catalog: [], productTypes: [] } });
  await assert.rejects(
    discoveryService(repository).selectAsin('100', { draftRevision: 1, asin: 'B0ABC12345' }, scope, {}),
    (error: unknown) => {
      assert.ok(error instanceof AmazonListingPublishDraftError);
      assert.equal(error.code, 'AMAZON_ASIN_NOT_IN_CANDIDATES');
      return true;
    }
  );
});

test('selects only a recommended product type for a full catalog draft', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({
    listingMode: 'FULL_CATALOG',
    candidateResults: {
      catalog: [],
      productTypes: [{ name: 'INCENSE', displayName: 'Incense', marketplaceIds: [MARKETPLACE_ID] }],
    },
  });
  const result = await discoveryService(repository).selectProductType(
    '100', { draftRevision: 1, productType: 'INCENSE' }, scope, {}
  );
  assert.equal(result.productType, 'INCENSE');
  assert.equal(result.status, 'ATTRIBUTES_REQUIRED');
  assert.equal(repository.transitionInput?.operation, 'AMAZON_PRODUCT_TYPE_SELECTED');
});

test('builds an editable field contract from a top-level Amazon product type schema', () => {
  const contract = buildAmazonAttributeContract(
    'INCENSE',
    'LISTING',
    'v1',
    'checksum',
    {
      type: 'object',
      required: ['item_name'],
      properties: {
        item_name: {
          title: 'Item Name',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              marketplace_id: { type: 'string' },
              language_tag: { type: 'string' },
            },
          },
        },
        material: {
          title: 'Material',
          type: 'array',
          minItems: 1,
          maxUniqueItems: 1,
          items: { type: 'object', properties: { value: { type: 'string' } } },
        },
      },
    },
    { identity: { title: 'Identity', propertyNames: ['item_name'] } }
  );
  assert.equal(contract.fields.length, 2);
  assert.equal(contract.editorVersion, 4);
  assert.equal(contract.fields.find((field) => field.name === 'item_name')?.required, true);
  assert.equal(contract.fields.find((field) => field.name === 'material')?.required, false);
  assert.equal(contract.fields.find((field) => field.name === 'material')?.maxItems, 1);
  assert.deepEqual(contract.fields.find((field) => field.name === 'item_name')?.selectors, ['marketplace_id', 'language_tag']);
  assert.deepEqual(contract.fields.find((field) => field.name === 'item_name')?.controls, [{
    path: ['value'],
    label: 'value',
    description: null,
    valueType: 'string',
    enumValues: [],
    required: false,
    format: null,
  }]);
});

test('normalizes Amazon schema errors to actionable attribute errors', () => {
  const errors = normalizeAmazonAjvErrors([
    {
      instancePath: '/brand/0',
      keyword: 'required',
      params: { missingProperty: 'language_tag' },
      message: "must have required property 'language_tag'",
    },
    {
      instancePath: '/',
      keyword: 'if',
      params: { failingKeyword: 'then' },
      message: 'must match "then" schema',
    },
    {
      instancePath: '/',
      keyword: 'required',
      params: { missingProperty: 'manufacturer' },
      message: "must have required property 'manufacturer'",
    },
    {
      instancePath: '/',
      keyword: 'required',
      params: { missingProperty: 'manufacturer' },
      message: "must have required property 'manufacturer'",
    },
  ]);
  assert.deepEqual(errors.map((error) => error.field), ['brand', 'manufacturer']);
  assert.equal(errors.some((error) => error.keyword === 'if'), false);
});

test('stores an eligible result when Amazon returns no ASIN restrictions', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({
    asin: 'B0GFD3FJKR',
    listingMode: 'OFFER_ONLY',
    candidateResults: { catalog: [], productTypes: [] },
  });
  const result = await discoveryService(repository).checkEligibility(
    '100',
    { draftRevision: 1, conditionType: 'new_new' },
    scope,
    { requestedByUserId: 7 }
  );
  assert.equal(result.status, 'ELIGIBILITY_CONFIRMED');
  assert.equal((result.candidateResults as any).eligibility.status, 'ELIGIBLE');
  assert.equal(repository.transitionInput?.operation, 'AMAZON_ELIGIBILITY_CHECKED');
});

test('records the ASIN restriction limitation for a new catalogue product', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({
    asin: null,
    listingMode: 'FULL_CATALOG',
    candidateResults: { catalog: [], productTypes: [] },
  });
  const result = await discoveryService(repository).checkEligibility(
    '100',
    { draftRevision: 1, conditionType: 'new_new' },
    scope,
    {}
  );
  assert.equal((result.candidateResults as any).eligibility.status, 'NOT_CHECKABLE_PRE_ASIN');
  assert.equal(repository.transitionInput?.operation, 'AMAZON_ELIGIBILITY_DEFERRED_NO_ASIN');
});

test('validates the exact mapped attributes against the cached Amazon schema', async () => {
  const repository = new FakePublishRepository();
  repository.schemaResult = {
    definitionSchema: {
      type: 'object',
      required: ['item_name'],
      properties: {
        item_name: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['value', 'marketplace_id'],
            properties: {
              value: { type: 'string', minLength: 1 },
              marketplace_id: { type: 'string' },
            },
          },
        },
      },
    },
    schemaChecksum: 'schema-1',
    resolvedVersion: 'v1',
  };
  repository.getDraftResult = draft({
    listingMode: 'FULL_CATALOG',
    productType: 'INCENSE',
    requirements: 'LISTING',
    candidateResults: {
      catalog: [],
      productTypes: [],
      eligibility: { status: 'NOT_CHECKABLE_PRE_ASIN', blocking: false },
    },
    mappedAttributes: {
      item_name: [{ value: 'Nivaana First Rain', marketplace_id: MARKETPLACE_ID }],
    },
  });
  const result = await service(repository).validateLocally(
    '100', { draftRevision: 1 }, scope, { requestedByUserId: 7 }
  );
  assert.equal(result.lastValidationStatus, 'LOCAL_VALID');
  assert.equal((result.candidateResults as any).validation.local.status, 'VALID');
  assert.match(String(result.validatedPayloadHash), /^[a-f0-9]{64}$/);
});

test('returns field-level local errors for incomplete Amazon attributes', async () => {
  const repository = new FakePublishRepository();
  repository.schemaResult = {
    definitionSchema: {
      type: 'object',
      required: ['item_name'],
      properties: { item_name: { type: 'array', minItems: 1 } },
    },
    schemaChecksum: 'schema-1',
    resolvedVersion: 'v1',
  };
  repository.getDraftResult = draft({
    listingMode: 'FULL_CATALOG',
    productType: 'INCENSE',
    requirements: 'LISTING',
    candidateResults: {
      catalog: [],
      productTypes: [],
      eligibility: { status: 'NOT_CHECKABLE_PRE_ASIN', blocking: false },
    },
    mappedAttributes: {},
  });
  const result = await service(repository).validateLocally('100', { draftRevision: 1 }, scope, {});
  assert.equal(result.lastValidationStatus, 'LOCAL_INVALID');
  assert.equal((result.candidateResults as any).validation.local.errors[0].field, 'item_name');
});

test('requires a full-catalog draft image before local validation', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({
    listingMode: 'FULL_CATALOG',
    productType: 'INCENSE',
    requirements: 'LISTING',
    images: [],
    candidateResults: {
      eligibility: { status: 'NOT_CHECKABLE_PRE_ASIN', blocking: false },
    },
  });
  await assert.rejects(
    () => service(repository).validateLocally('100', { draftRevision: 1 }, scope, {}),
    (error: unknown) => error instanceof AmazonListingPublishDraftError
      && error.code === 'AMAZON_DRAFT_IMAGE_REQUIRED'
  );
});

test('requires public accessibility verification for full-catalog images', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({
    listingMode: 'FULL_CATALOG',
    productType: 'INCENSE',
    requirements: 'LISTING',
    images: [{
      id: 501n,
      status: 'ACTIVE',
      accessibilityStatus: 'PENDING',
      url: 'https://storage.example/product-main.jpg',
    }],
    candidateResults: {
      eligibility: { status: 'NOT_CHECKABLE_PRE_ASIN', blocking: false },
    },
  });
  await assert.rejects(
    () => service(repository).validateLocally('100', { draftRevision: 1 }, scope, {}),
    (error: unknown) => error instanceof AmazonListingPublishDraftError
      && error.code === 'AMAZON_DRAFT_IMAGE_VERIFICATION_REQUIRED'
  );
});

test('sends a locally validated offer-only payload through Amazon validation preview', async () => {
  const repository = new FakePublishRepository();
  repository.schemaResult = {
    definitionSchema: {
      type: 'object',
      required: ['merchant_suggested_asin', 'condition_type'],
      properties: {
        merchant_suggested_asin: { type: 'array', minItems: 1 },
        condition_type: { type: 'array', minItems: 1 },
        purchasable_offer: { type: 'array' },
      },
    },
    schemaChecksum: 'schema-offer',
    resolvedVersion: 'v1',
  };
  repository.getDraftResult = draft({
    asin: 'B0GFD3FJKR',
    listingMode: 'OFFER_ONLY',
    productType: 'INCENSE',
    requirements: 'LISTING_OFFER_ONLY',
    candidateResults: {
      catalog: [],
      productTypes: [],
      eligibility: { status: 'ELIGIBLE', blocking: false },
    },
    mappedAttributes: { purchasable_offer: [{ currency: 'INR' }] },
  });
  let previewInput: any;
  const client = {
    getSellerId: () => SELLER_ID,
    getMarketplaceId: () => MARKETPLACE_ID,
    fetchListingsPage: async () => ({ items: [], nextToken: null }),
    fetchFbaInventoryPage: async () => ({ items: [], nextToken: null }),
    previewListingItem: async (input: any) => {
      previewInput = input;
      return { submissionId: null, status: 'VALID', issues: [], identifiers: [] };
    },
  };
  const validationService = new AmazonListingPublishDraftService(repository, client);
  const local = await validationService.validateLocally('100', { draftRevision: 1 }, scope, {});
  repository.getDraftResult = {
    ...repository.getDraftResult,
    ...local,
    id: 100n,
    productId: 42n,
    asin: 'B0GFD3FJKR',
    listingMode: 'OFFER_ONLY',
    productType: 'INCENSE',
    requirements: 'LISTING_OFFER_ONLY',
    sellerSku: 'NIV-NIV-0042',
    mappedAttributes: { purchasable_offer: [{ currency: 'INR' }] },
    draftRevision: 2,
  };
  const result = await validationService.previewValidation('100', { draftRevision: 2 }, scope, {});
  assert.equal(result.lastValidationStatus, 'AMAZON_VALID');
  assert.equal(previewInput.requirements, 'LISTING_OFFER_ONLY');
  assert.equal(previewInput.attributes.merchant_suggested_asin[0].value, 'B0GFD3FJKR');
  assert.equal(previewInput.attributes.condition_type[0].value, 'new_new');
});

test('submits only the exact recently validated payload after explicit confirmation', async () => {
  const repository = new FakePublishRepository();
  repository.schemaResult = {
    definitionSchema: {
      type: 'object',
      required: ['merchant_suggested_asin', 'condition_type'],
      properties: {
        merchant_suggested_asin: { type: 'array', minItems: 1 },
        condition_type: { type: 'array', minItems: 1 },
        purchasable_offer: { type: 'array' },
      },
    },
    schemaChecksum: 'schema-offer',
    resolvedVersion: 'v1',
  };
  const base = {
    asin: 'B0GFD3FJKR',
    listingMode: 'OFFER_ONLY',
    productType: 'INCENSE',
    requirements: 'LISTING_OFFER_ONLY',
    sellerSku: 'NIV-NIV-0042',
    schemaChecksum: 'schema-offer',
    candidateResults: {
      catalog: [],
      productTypes: [],
      eligibility: { status: 'ELIGIBLE', blocking: false },
    },
    mappedAttributes: { purchasable_offer: [{ currency: 'INR' }] },
  };
  repository.getDraftResult = draft(base);
  let submitted = 0;
  let guardChecks = 0;
  const client = {
    getSellerId: () => SELLER_ID,
    getMarketplaceId: () => MARKETPLACE_ID,
    fetchListingsPage: async () => ({ items: [], nextToken: null }),
    fetchFbaInventoryPage: async () => ({ items: [], nextToken: null }),
    previewListingItem: async () => ({
      submissionId: null, status: 'VALID', issues: [], identifiers: [],
    }),
    submitListingItem: async () => {
      submitted += 1;
      return { submissionId: 'submission-123', status: 'ACCEPTED', issues: [] };
    },
  };
  const validationService = new AmazonListingPublishDraftService(repository, client, {
    assertEnabled: async () => {
      guardChecks += 1;
      return { effectiveEnabled: true };
    },
  } as any, {
    listingCreationEnabled: true,
    fullCatalogCreationEnabled: true,
  });
  const local = await validationService.validateLocally('100', { draftRevision: 1 }, scope, {});
  repository.getDraftResult = {
    ...draft(base),
    ...local,
    ...base,
    id: 100n,
    productId: 42n,
    lastValidationStatus: local.lastValidationStatus,
    validatedPayloadHash: local.validatedPayloadHash,
    candidateResults: local.candidateResults,
    draftRevision: 2,
  };
  const preview = await validationService.previewValidation('100', { draftRevision: 2 }, scope, {});
  repository.getDraftResult = {
    ...draft(base),
    ...preview,
    ...base,
    id: 100n,
    productId: 42n,
    status: 'AMAZON_VALIDATED',
    lastValidationStatus: preview.lastValidationStatus,
    validatedPayloadHash: preview.validatedPayloadHash,
    candidateResults: preview.candidateResults,
    draftRevision: 3,
  };
  const result = await validationService.submit('100', {
    draftRevision: 3,
    confirmed: true,
    confirmationText: 'NIV-NIV-0042',
    idempotencyKey: 'f26f7938-e9f1-4e7d-94cc-3a8c7e0bca44',
  }, scope, { requestedByUserId: 7 });
  assert.equal(result.status, 'SUBMITTED');
  assert.equal(submitted, 1);
  assert.equal(guardChecks, 1);
  assert.equal(repository.acceptedSubmissionInput.amazonSubmissionId, 'submission-123');
  assert.equal(repository.acceptedSubmissionInput.payloadHash, preview.validatedPayloadHash);
});

test('blocks submission when the dedicated listing creation switch is off', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({ status: 'AMAZON_VALIDATED', lastValidationStatus: 'AMAZON_VALID' });
  const publishService = new AmazonListingPublishDraftService(
    repository,
    {} as any,
    { assertEnabled: async () => ({ effectiveEnabled: true }) } as any,
    { listingCreationEnabled: false, fullCatalogCreationEnabled: false }
  );
  await assert.rejects(
    () => publishService.submit('100', {
      draftRevision: 1,
      confirmed: true,
      confirmationText: 'NIV-NIV-0042',
      idempotencyKey: 'f26f7938-e9f1-4e7d-94cc-3a8c7e0bca44',
    }, scope, {}),
    (error: unknown) => error instanceof AmazonListingPublishDraftError
      && error.code === 'AMAZON_LISTING_CREATION_DISABLED'
  );
});

test('blocks submission when the source Nivaana product changed', async () => {
  const repository = new FakePublishRepository();
  repository.productResult = product({ modifieddate: 1720000000001n });
  repository.getDraftResult = draft({ status: 'AMAZON_VALIDATED', lastValidationStatus: 'AMAZON_VALID' });
  const publishService = new AmazonListingPublishDraftService(
    repository,
    {} as any,
    { assertEnabled: async () => ({ effectiveEnabled: true }) } as any,
    { listingCreationEnabled: true, fullCatalogCreationEnabled: true }
  );
  await assert.rejects(
    () => publishService.submit('100', {
      draftRevision: 1,
      confirmed: true,
      confirmationText: 'NIV-NIV-0042',
      idempotencyKey: 'f26f7938-e9f1-4e7d-94cc-3a8c7e0bca44',
    }, scope, {}),
    (error: unknown) => error instanceof AmazonListingPublishDraftError
      && error.code === 'AMAZON_DRAFT_SOURCE_PRODUCT_STALE'
  );
});

test('blocks submission when another Amazon record already owns the seller SKU', async () => {
  const repository = new FakePublishRepository();
  repository.skuConflictResult = { type: 'LISTING', id: '77', productId: '99' };
  repository.getDraftResult = draft({ status: 'AMAZON_VALIDATED', lastValidationStatus: 'AMAZON_VALID' });
  const publishService = new AmazonListingPublishDraftService(
    repository,
    {} as any,
    { assertEnabled: async () => ({ effectiveEnabled: true }) } as any,
    { listingCreationEnabled: true, fullCatalogCreationEnabled: true }
  );
  await assert.rejects(
    () => publishService.submit('100', {
      draftRevision: 1,
      confirmed: true,
      confirmationText: 'NIV-NIV-0042',
      idempotencyKey: 'f26f7938-e9f1-4e7d-94cc-3a8c7e0bca44',
    }, scope, {}),
    (error: unknown) => error instanceof AmazonListingPublishDraftError
      && error.code === 'AMAZON_SELLER_SKU_CONFLICT'
  );
});

test('reconciles an accepted submission to a live mapped listing', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({
    status: 'SUBMITTED',
    draftRevision: 4,
    sellerSku: 'NIV-NIV-0042',
    candidateResults: {
      catalog: [],
      productTypes: [],
      validation: {
        submission: { status: 'ACCEPTED', submissionId: 'submission-123' },
      },
    },
  });
  const reconciliationService = new AmazonListingPublishDraftService(repository, {
    getSellerId: () => SELLER_ID,
    getMarketplaceId: () => MARKETPLACE_ID,
    fetchListingsPage: async () => ({ items: [], nextToken: null }),
    fetchFbaInventoryPage: async () => ({ items: [], nextToken: null }),
    fetchListing: async () => ({
      sku: 'NIV-NIV-0042',
      summaries: [{
        marketplaceId: MARKETPLACE_ID,
        asin: 'B0GFD3FJKR',
        itemName: 'Nivaana First Rain',
        status: ['BUYABLE', 'DISCOVERABLE'],
      }],
      productTypes: [{ marketplaceId: MARKETPLACE_ID, productType: 'INCENSE' }],
      offers: [{ marketplaceId: MARKETPLACE_ID, price: { amount: '299', currencyCode: 'INR' } }],
      fulfillmentAvailability: [{ fulfillmentChannelCode: 'DEFAULT', quantity: 8 }],
      issues: [],
    }),
  });
  const result = await reconciliationService.reconcileSubmission(
    '100', { draftRevision: 4 }, scope, { requestedByUserId: 7 }
  );
  assert.equal(result.status, 'LIVE');
  assert.equal(repository.reconciliationInput.state, 'LIVE');
  assert.equal(repository.reconciliationInput.listing.asin, 'B0GFD3FJKR');
  assert.equal((result.candidateResults as any).validation.reconciliation.listingStatus, 'BUYABLE,DISCOVERABLE');
});

test('keeps a submitted listing in needs-attention state when Amazon returns a blocking issue', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({
    status: 'SUBMITTED',
    draftRevision: 4,
    sellerSku: 'NIV-NIV-0042',
    candidateResults: { catalog: [], productTypes: [] },
  });
  const reconciliationService = new AmazonListingPublishDraftService(repository, {
    getSellerId: () => SELLER_ID,
    getMarketplaceId: () => MARKETPLACE_ID,
    fetchListingsPage: async () => ({ items: [], nextToken: null }),
    fetchFbaInventoryPage: async () => ({ items: [], nextToken: null }),
    fetchListing: async () => ({
      sku: 'NIV-NIV-0042',
      summaries: [{ marketplaceId: MARKETPLACE_ID, asin: 'B0GFD3FJKR', status: [] }],
      issues: [{
        code: 'MISSING_IMAGE',
        message: 'A main image is required',
        severity: 'ERROR',
        attributeNames: ['main_product_image_locator'],
      }],
    }),
  });
  const result = await reconciliationService.reconcileSubmission(
    '100', { draftRevision: 4 }, scope, {}
  );
  assert.equal(result.status, 'NEEDS_ATTENTION');
  assert.equal(repository.reconciliationInput.state, 'NEEDS_ATTENTION');
  assert.equal((result.candidateResults as any).validation.reconciliation.issues[0].code, 'MISSING_IMAGE');
});

test('reopens a needs-attention submission for correction without losing issue history', async () => {
  const repository = new FakePublishRepository();
  repository.getDraftResult = draft({
    status: 'NEEDS_ATTENTION',
    draftRevision: 5,
    lastSubmissionStatus: 'NEEDS_ATTENTION',
    lastValidationStatus: 'AMAZON_VALID',
    validatedPayloadHash: 'old-hash',
    candidateResults: {
      catalog: [],
      productTypes: [],
      eligibility: { status: 'ELIGIBLE', blocking: false },
      validation: {
        reconciliation: {
          state: 'NEEDS_ATTENTION',
          issues: [{
            code: 'MISSING_IMAGE',
            severity: 'ERROR',
            attributeNames: ['main_product_image_locator'],
          }],
        },
      },
    },
  });
  const result = await service(repository).reopenForCorrection(
    '100',
    { draftRevision: 5, confirmed: true, reason: 'Upload the required main image' },
    scope,
    { requestedByUserId: 7 }
  );
  assert.equal(result.status, 'ATTRIBUTES_REQUIRED');
  assert.equal(result.lastValidationStatus, null);
  assert.equal(result.validatedPayloadHash, null);
  assert.equal((result.candidateResults as any).eligibility, undefined);
  assert.equal((result.candidateResults as any).validation.correction.status, 'OPEN');
  assert.equal((result.candidateResults as any).validation.correction.issues[0].code, 'MISSING_IMAGE');
  assert.equal(repository.reopenCorrectionInput.reason, 'Upload the required main image');
});
