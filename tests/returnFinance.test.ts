import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateCreditNoteTaxBreakup,
  hasActiveCreditNoteForResolution,
  resolveCreditNoteRefundAmount,
} from '../src/utils/returnFinance.ts';

test('calculates proportional GST breakup for a partial credit note', () => {
  const breakup = calculateCreditNoteTaxBreakup(
    {
      orderline: {
        orderamount: 2360,
        taxable_amount: 2000,
        gst_rate: 18,
        cgst_amount: 180,
        sgst_amount: 180,
        total_gst_amount: 360,
        hsn_code: '330499',
      },
    },
    1180,
    {}
  );

  assert.equal(breakup.taxableAmount, 1000);
  assert.equal(breakup.gstRate, 18);
  assert.equal(breakup.cgstAmount, 90);
  assert.equal(breakup.sgstAmount, 90);
  assert.equal(breakup.igstAmount, null);
  assert.equal(breakup.totalGstAmount, 180);
  assert.equal(breakup.hsnCode, '330499');
});

test('derives taxable and GST values from GST rate when line tax fields are unavailable', () => {
  const breakup = calculateCreditNoteTaxBreakup(
    {
      orderline: {
        orderamount: 1180,
        gst_rate: 18,
      },
    },
    1180,
    {}
  );

  assert.equal(breakup.taxableAmount, 1000);
  assert.equal(breakup.totalGstAmount, 180);
  assert.equal(breakup.cgstAmount, 90);
  assert.equal(breakup.sgstAmount, 90);
});

test('uses persisted order GST totals for a single-product return when line tax fields are unavailable', () => {
  const breakup = calculateCreditNoteTaxBreakup(
    {
      orderline: { orderamount: 40 },
      order: {
        productid: [44],
        total_taxable_amount: 38.1,
        total_cgst_amount: 0.95,
        total_sgst_amount: 0.95,
        total_igst_amount: 0,
        total_gst_amount: 1.9,
      },
    },
    40,
    {}
  );

  assert.equal(breakup.taxableAmount, 38.1);
  assert.equal(breakup.gstRate, 4.99);
  assert.equal(breakup.cgstAmount, 0.95);
  assert.equal(breakup.sgstAmount, 0.95);
  assert.equal(breakup.totalGstAmount, 1.9);
});

test('honors manual credit note tax overrides', () => {
  const breakup = calculateCreditNoteTaxBreakup(
    {
      orderline: {
        orderamount: 1180,
        taxable_amount: 1000,
        total_gst_amount: 180,
      },
    },
    500,
    {
      taxable_amount: 450,
      gst_rate: 12,
      cgst_amount: 25,
      sgst_amount: 25,
      total_gst_amount: 50,
      hsn_code: 'OVERRIDE',
    }
  );

  assert.equal(breakup.taxableAmount, 450);
  assert.equal(breakup.gstRate, 12);
  assert.equal(breakup.cgstAmount, 25);
  assert.equal(breakup.sgstAmount, 25);
  assert.equal(breakup.totalGstAmount, 50);
  assert.equal(breakup.hsnCode, 'OVERRIDE');
});

test('resolves refund amount from override first, then completed action amount', () => {
  assert.equal(resolveCreditNoteRefundAmount({ amount: 1180.456 }, {}), 1180.46);
  assert.equal(resolveCreditNoteRefundAmount({ amount: 1180 }, { refund_amount: 250.235 }), 250.24);
  assert.throws(() => resolveCreditNoteRefundAmount({ amount: 0 }, {}), /Refund amount required/);
});

test('detects active credit notes for the same resolution action while ignoring void notes', () => {
  assert.equal(
    hasActiveCreditNoteForResolution(
      [
        { resolutionActionId: 7, status: 'void' },
        { resolutionActionId: 8, status: 'issued' },
      ],
      7
    ),
    false
  );
  assert.equal(
    hasActiveCreditNoteForResolution(
      [
        { resolutionActionId: 7, status: 'draft' },
        { resolutionActionId: 8, status: 'issued' },
      ],
      7
    ),
    true
  );
});
