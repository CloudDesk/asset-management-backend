import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmazonReturnReport } from './amazon-return.service.js';

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
