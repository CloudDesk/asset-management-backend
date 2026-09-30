import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductSchema } from '../src/schemas/product.schema.js';
import { GstService, type GstTypeResult } from '../src/services/gst.service.js';

const intraState: GstTypeResult = {
  gst_type: 'INTRA-STATE',
  cgst: true,
  sgst: true,
  igst: false,
  fromState: 'Karnataka',
  toState: 'Karnataka',
};

test('product creation requires HSN and GST fields', () => {
  const result = createProductSchema.safeParse({
    name: 'Tax test product',
    shortname: 'Tax test',
    puc: 'TAX-TEST-1',
    remarks: 'Tax test',
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    assert.ok(paths.includes('hsn_code'));
    assert.ok(paths.includes('gst_rate'));
  }
});

test('GST calculation uses the immutable orderline snapshot', async () => {
  const service = new GstService();
  const result = await service.calculateGstForOrderline(
    112,
    intraState,
    { hsn_code: '330499', gst_rate: 12 },
  );

  assert.equal(result.hsn_code, '330499');
  assert.equal(result.gst_rate, 12);
  assert.equal(result.taxable_amount, 100);
  assert.equal(result.cgst_amount, 6);
  assert.equal(result.sgst_amount, 6);
  assert.equal(result.total_gst_amount, 12);
});

test('GST calculation rejects an incomplete orderline snapshot', async () => {
  const service = new GstService();
  await assert.rejects(
    service.calculateGstForOrderline(
      118,
      intraState,
      { hsn_code: null, gst_rate: 18 },
    ),
    /mandatory immutable HSN\/GST snapshot/,
  );
});

test('GST calculation rejects an out-of-range saved GST rate', async () => {
  const service = new GstService();
  await assert.rejects(
    service.calculateGstForOrderline(
      201,
      intraState,
      { hsn_code: '330499', gst_rate: 101 },
    ),
    /mandatory immutable HSN\/GST snapshot/,
  );
});
