import assert from 'node:assert/strict';
import test from 'node:test';
import { GstService } from '../services/gst.service.js';
import { gstTypeFromLines, planOrderLineGstRefresh, type GstRefreshLine } from './orderLineGstRefresh.js';

const gst = new GstService();
const calculate = gst.calculateGstAmounts.bind(gst);
const intraLine = (id: number, orderamount: number, rate: number, taxable: number, totalGst: number): GstRefreshLine => ({
  id, orderamount, gst_rate: rate, hsn_code: `HSN${id}`, taxable_amount: taxable,
  cgst_amount: totalGst / 2, sgst_amount: totalGst / 2, igst_amount: 0, total_gst_amount: totalGst,
});

test('order 178: lines after the Rs. 50 coupon are taxed on the final amount', () => {
  // GST was saved on 43.93 / 2,039.79 / 1,311.28 before the coupon moved the lines to 43.29 / 2,009.75 / 1,291.96.
  const lines = [intraLine(272, 43.29, 5, 41.84, 2.09), intraLine(273, 2009.75, 18, 1728.64, 311.15), intraLine(274, 1291.96, 18, 1111.25, 200.03)];
  const plan = planOrderLineGstRefresh(lines, calculate)!;
  assert.deepEqual(plan.lines.map(({ id, gst: line }) => [id, line.taxable_amount, line.total_gst_amount, line.hsn_code]), [
    [272, 41.23, 2.06, 'HSN272'], [273, 1703.18, 306.57, 'HSN273'], [274, 1094.88, 197.08, 'HSN274'],
  ]);
  assert.equal(plan.totals.total_taxable_amount, 2839.29);
  assert.equal(plan.totals.total_gst_amount, 505.71);
  assert.equal(Math.round((plan.totals.total_taxable_amount + plan.totals.total_gst_amount) * 100) / 100, 3345);
  assert.equal(plan.totals.total_igst_amount, 0);
  assert.equal(plan.lines.every(({ gst: line }) => line.cgst_amount + line.sgst_amount === line.total_gst_amount || Math.abs(line.cgst_amount + line.sgst_amount - line.total_gst_amount) <= 0.01), true);
});

test('order 177 (wallet) and orders without a coupon are not touched', () => {
  const lines = [intraLine(269, 43.93, 5, 41.84, 2.09), intraLine(270, 2039.79, 18, 1728.64, 311.15), intraLine(271, 1311.28, 18, 1111.25, 200.03)];
  assert.equal(planOrderLineGstRefresh(lines, calculate), undefined);
});

test('only the changed line is recalculated; totals include the unchanged lines', () => {
  const lines = [intraLine(1, 43.29, 5, 41.84, 2.09), intraLine(2, 2039.79, 18, 1728.64, 311.15)];
  const plan = planOrderLineGstRefresh(lines, calculate)!;
  assert.deepEqual(plan.lines.map((item) => item.id), [1]);
  assert.equal(plan.totals.total_taxable_amount, 1769.87);
  assert.equal(plan.totals.total_gst_amount, 313.21);
});

test('the IGST type is kept for inter-state orders', () => {
  const lines: GstRefreshLine[] = [{ id: 1, orderamount: 100, gst_rate: 18, hsn_code: null, taxable_amount: 93.22, cgst_amount: 0, sgst_amount: 0, igst_amount: 16.78, total_gst_amount: 16.78 }];
  const plan = planOrderLineGstRefresh(lines, calculate)!;
  assert.equal(gstTypeFromLines(lines)?.gst_type, 'INTER-STATE');
  assert.deepEqual([plan.lines[0]!.gst.taxable_amount, plan.lines[0]!.gst.igst_amount, plan.lines[0]!.gst.cgst_amount], [84.75, 15.25, 0]);
});

test('lines without GST yet are left to the existing reconciliation', () => {
  const noGstYet: GstRefreshLine[] = [{ id: 1, orderamount: 90, gst_rate: 18, hsn_code: null, taxable_amount: null, cgst_amount: null, sgst_amount: null, igst_amount: null, total_gst_amount: null }];
  assert.equal(planOrderLineGstRefresh(noGstYet, calculate), undefined);
});

test('0% lines get taxable = final amount even though no GST type can be read', () => {
  const zeroRated: GstRefreshLine[] = [{ id: 1, orderamount: 90, gst_rate: 0, hsn_code: null, taxable_amount: 100, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_gst_amount: 0 }];
  const plan = planOrderLineGstRefresh(zeroRated, calculate)!;
  assert.deepEqual([plan.lines[0]!.gst.taxable_amount, plan.lines[0]!.gst.total_gst_amount], [90, 0]);
  // A taxed line with no recorded type is not guessed.
  const unknownType: GstRefreshLine[] = [{ id: 1, orderamount: 90, gst_rate: 18, hsn_code: null, taxable_amount: 100, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_gst_amount: 0 }];
  assert.equal(planOrderLineGstRefresh(unknownType, calculate), undefined);
});
