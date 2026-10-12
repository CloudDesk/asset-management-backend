// User-facing messages for Bulk Add Stock (POST /v1/stocks/bulk-insert).

const STOCK_FIELD_LABELS: Record<string, string> = {
  puc: 'Product',
  platform: 'Platform',
  serialnumber: 'Serial number',
  stockstatus: 'Stock status',
  manufacturedyear: 'Manufactured date',
  releaseyear: 'Release date',
  ecompublish: 'E-commerce publish',
  poid: 'Purchase order',
  supplierid: 'Supplier',
  batchno: 'Batch number',
  rfid: 'RFID',
  instances: 'Quantity',
};

const labelFor = (field: string) => STOCK_FIELD_LABELS[field] ?? 'One of the stock details';

/**
 * Reword a failed stock insert (raw database text) so the user knows what to do.
 * The original error is logged where the failure happens.
 */
export function toFriendlyStockInsertError(rawMessage: string | undefined): string {
  const text = rawMessage ?? '';

  if (/23505|duplicate key|already exists/i.test(text)) {
    return 'Some of these stock items already exist. Please refresh the page and check the stock list before adding again.';
  }
  if (/22001|value too long/i.test(text)) {
    return 'Some of the text entered is too long. Please shorten it and try again.';
  }
  if (/23503|foreign key|fk_puc/i.test(text)) {
    return 'This product could not be found. Please refresh the page and try again.';
  }
  return 'These stock items could not be saved. Please try again.';
}

interface SchemaValidationIssue {
  instancePath?: string;
  keyword?: string;
  params?: Record<string, any>;
}

const describeIssue = (issue: SchemaValidationIssue): string => {
  const pathParts = (issue.instancePath ?? '').split('/').filter(Boolean);
  const field = pathParts.find((part) => !/^\d+$/.test(part));
  const params = issue.params ?? {};

  if (!field) {
    if (issue.keyword === 'required') {
      return `${labelFor(params.missingProperty)} is required.`;
    }
    return 'Please add the stock details before saving.';
  }

  const label = labelFor(field);
  switch (issue.keyword) {
    case 'maximum':
      return field === 'instances'
        ? `Quantity can be at most ${Number(params.limit).toLocaleString('en-IN')}.`
        : `${label} is too large.`;
    case 'minimum':
      return field === 'instances'
        ? `Quantity must be at least ${params.limit}.`
        : `${label} is too small.`;
    case 'maxLength':
      return `${label} must be ${params.limit} characters or fewer.`;
    case 'type':
      return field === 'instances' ? 'Quantity must be a number.' : `${label} has an invalid value.`;
    default:
      return `${label} has an invalid value.`;
  }
};

/** Route-level schemaErrorFormatter: Fastify adds statusCode 400 to the returned error. */
export function formatBulkStockValidationError(errors: SchemaValidationIssue[]): Error {
  const messages = [...new Set((errors ?? []).map(describeIssue))];
  return new Error(messages.join(' ') || 'Some stock details are not valid. Please check the form.');
}
