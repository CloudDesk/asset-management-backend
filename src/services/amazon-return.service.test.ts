import test from 'node:test';
import assert from 'node:assert/strict';
import { AmazonReturnService, parseAmazonReturnReport } from './amazon-return.service.js';
import { prisma } from '../models/prisma.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';

for (const processingStatus of ['CANCELLED', 'FATAL', 'DONE']) {
  test(`return report ${processingStatus} keeps cancellation separate from failure and success`, async () => {
    const originalFind = prisma.amazonReturnImportJob.findUnique;
    const originalUpdate = prisma.amazonReturnImportJob.update;
    const originalResolve = amazonListingScopeService.resolveForSeller;
    const job = { id: 1n, sellerId: 'SELLER', marketplaceId: 'MARKET', fulfilmentType: 'FBA',
      reportType: 'RETURNS', amazonReportId: 'report-1', status: 'PROCESSING', activeKey: 'active',
      fetched: 0, created: 0, updated: 0, unmapped: 0, errorMessage: null };
    let downloads = 0;
    let persisted = 0;
    try {
      prisma.amazonReturnImportJob.findUnique = (async () => job) as any;
      prisma.amazonReturnImportJob.update = (async ({ data }: any) => Object.assign(job, data)) as any;
      amazonListingScopeService.resolveForSeller = (async () => ({ sellerId: 'SELLER', marketplaceId: 'MARKET', client: {
        createReport: async () => { throw new Error('Existing report must be reused'); },
        getReport: async () => ({ processingStatus, ...(processingStatus === 'DONE' ? { reportDocumentId: 'doc-1' } : {}) }),
        downloadReportDocument: async () => { ++downloads; return ''; },
      } })) as any;
      const service = new AmazonReturnService() as any;
      service.persistRows = async () => { ++persisted; return { fetched: 0, created: 0, updated: 0, unmapped: 0 }; };
      await service.run(job.id);
      assert.equal(job.status, processingStatus === 'DONE' ? 'COMPLETED' : processingStatus === 'FATAL' ? 'FAILED' : 'CANCELLED');
      assert.equal(job.activeKey, null);
      assert.equal(downloads, processingStatus === 'DONE' ? 1 : 0);
      assert.equal(persisted, processingStatus === 'DONE' ? 1 : 0);
      assert.equal(job.errorMessage === null, processingStatus !== 'FATAL');
    } finally {
      prisma.amazonReturnImportJob.findUnique = originalFind;
      prisma.amazonReturnImportJob.update = originalUpdate;
      amazonListingScopeService.resolveForSeller = originalResolve;
    }
  });
}

test('previous cancelled-report failures are displayed as cancelled without rewriting stored history', () => {
  const job = { id: 1n, fulfilmentType: 'FBA', status: 'FAILED', errorMessage: 'Amazon return report ended with CANCELLED' };
  const serialized = (new AmazonReturnService() as any).serializeJob(job);
  assert.equal(serialized.status, 'CANCELLED');
  assert.equal(serialized.errorMessage, null);
  assert.equal(job.status, 'FAILED');
});

test('parses FBA return reports and preserves quoted tabs and newlines', () => {
  const rows = parseAmazonReturnReport(
    'return-date\torder-id\tsku\tquantity\tcustomer-comments\r\n'
    + '2026-07-26\tORDER-1\tSKU-1\t2\t"Box opened\tbut item is fine"\r\n'
    + '2026-07-27\tORDER-2\tSKU-2\t1\t"Line one\nLine two"\r\n'
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.['order-id'], 'ORDER-1');
  assert.equal(rows[0]?.['customer-comments'], 'Box opened\tbut item is fine');
  assert.equal(rows[1]?.['customer-comments'], 'Line one\nLine two');
});

test('parses FBM report headers without changing Amazon field names', () => {
  const [row] = parseAmazonReturnReport(
    'order-id\tamazon-rma-id\tmerchant-sku\treturn-quantity\treturn-request-status\n'
    + 'ORDER-3\tRMA-3\tSKU-3\t1\tApproved\n'
  );
  assert.deepEqual(row, {
    'order-id': 'ORDER-3',
    'amazon-rma-id': 'RMA-3',
    'merchant-sku': 'SKU-3',
    'return-quantity': '1',
    'return-request-status': 'Approved',
  });
});
