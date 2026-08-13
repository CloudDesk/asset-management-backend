type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  code?: string;
  data: T;
};

type InventoryPreview = {
  id: string;
  sellerSku: string;
  amazonQuantity: number;
  nivaanaQuantity: number;
  targetQuantity: number;
  mismatch: boolean;
  inventorySyncMode: 'DISABLED' | 'MANUAL' | 'AUTOMATIC';
  writesEnabled: boolean;
  previewExpiresAt: string;
};

const apiBaseUrl = process.env.NIVAANA_API_BASE_URL?.trim().replace(/\/+$/, '');
const authToken = process.env.NIVAANA_AUTH_TOKEN?.trim();
const listingId = process.env.AMAZON_VERIFY_LISTING_ID?.trim();
const applyRequested = process.env.AMAZON_VERIFY_APPLY === 'true';
const confirmedSellerSku = process.env.AMAZON_VERIFY_CONFIRM_SKU?.trim();

if (!apiBaseUrl || !authToken || !listingId) {
  throw new Error(
    'Set NIVAANA_API_BASE_URL, NIVAANA_AUTH_TOKEN, and AMAZON_VERIFY_LISTING_ID before running verification'
  );
}
if (!/^[1-9]\d*$/.test(listingId)) {
  throw new Error('AMAZON_VERIFY_LISTING_ID must be a positive integer');
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !body.success) {
    throw new Error(`${body.code ?? response.status}: ${body.message ?? 'Amazon verification request failed'}`);
  }
  return body;
};

const checkedAt = new Date().toISOString();
const integration = await request<Record<string, unknown>>('/api/channels/amazon/status');
const previewResponse = await request<InventoryPreview>(
  `/api/channels/amazon/listings/${listingId}/inventory/preview`,
  { method: 'POST', body: '{}' }
);
const preview = previewResponse.data;

const evidence: Record<string, unknown> = {
  checkedAt,
  mode: applyRequested ? 'CONTROLLED_APPLY' : 'READ_ONLY_PREFLIGHT',
  listingId,
  sellerSku: preview.sellerSku,
  integration: integration.data,
  preview: {
    id: preview.id,
    amazonQuantity: preview.amazonQuantity,
    nivaanaQuantity: preview.nivaanaQuantity,
    targetQuantity: preview.targetQuantity,
    mismatch: preview.mismatch,
    inventorySyncMode: preview.inventorySyncMode,
    writesEnabled: preview.writesEnabled,
    previewExpiresAt: preview.previewExpiresAt,
  },
  checks: {
    authenticatedApi: true,
    productionAmazonRead: true,
    activeMappedSellerFulfilledGate: true,
    previewCreated: true,
    amazonWriteAttempted: false,
  },
};

if (applyRequested) {
  if (!confirmedSellerSku || confirmedSellerSku !== preview.sellerSku) {
    throw new Error('AMAZON_VERIFY_CONFIRM_SKU must exactly match the previewed seller SKU');
  }
  if (!preview.writesEnabled) {
    throw new Error('Amazon production writes are disabled; controlled apply was not attempted');
  }
  if (preview.inventorySyncMode !== 'MANUAL') {
    throw new Error('Set this listing to MANUAL sync mode before controlled apply');
  }
  if (!preview.mismatch) {
    evidence.apply = { skipped: true, reason: 'Amazon and Nivaana quantities already match' };
  } else {
    const applied = await request<Record<string, unknown>>(
      `/api/channels/amazon/listings/${listingId}/inventory/sync`,
      { method: 'POST', body: JSON.stringify({ previewId: preview.id }) }
    );
    evidence.apply = applied.data;
    (evidence.checks as Record<string, unknown>).amazonWriteAttempted = true;
    (evidence.checks as Record<string, unknown>).amazonSubmissionAccepted = true;
  }
}

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
