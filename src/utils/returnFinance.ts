export type CreditNoteTaxOverride = {
  refund_amount?: number | undefined;
  taxable_amount?: number | undefined;
  gst_rate?: number | undefined;
  cgst_amount?: number | undefined;
  sgst_amount?: number | undefined;
  igst_amount?: number | undefined;
  total_gst_amount?: number | undefined;
  hsn_code?: string | undefined;
};

export type CreditNoteResolutionAction = {
  id?: number;
  amount?: unknown;
  status?: string;
};

export type CreditNoteRecord = {
  resolutionActionId?: number | null;
  status?: string | null;
};

export function numberFromFinanceValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'object' && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  const normalized = String(value).replace(/[^0-9.-]+/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function positiveFinanceNumber(value: unknown, fallback: number) {
  const numeric = numberFromFinanceValue(value);
  return numeric && numeric > 0 ? numeric : fallback;
}

export function roundCurrency(value: number) {
  return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
}

export function resolveCreditNoteRefundAmount(action: CreditNoteResolutionAction, data: CreditNoteTaxOverride) {
  const amount = positiveFinanceNumber(data.refund_amount, positiveFinanceNumber(action.amount, 0));
  if (amount <= 0) {
    throw new Error('Refund amount required');
  }
  return roundCurrency(amount);
}

export function hasActiveCreditNoteForResolution(
  creditNotes: CreditNoteRecord[] | undefined,
  resolutionActionId: number
) {
  return (creditNotes || []).some((creditNote) =>
    Number(creditNote.resolutionActionId) === Number(resolutionActionId) && creditNote.status !== 'void'
  );
}

export function calculateCreditNoteTaxBreakup(
  request: { orderline?: Record<string, any> | null; order?: Record<string, any> | null },
  refundAmount: number,
  data: CreditNoteTaxOverride
) {
  const orderline = request.orderline || {};
  const order = request.order || {};
  const linePaidAmount = positiveFinanceNumber(
    orderline.orderamount,
    positiveFinanceNumber(orderline.productamount, positiveFinanceNumber(order.orderamount, refundAmount))
  );
  const proportion = linePaidAmount > 0 ? Math.min(1, refundAmount / linePaidAmount) : 1;
  const gstRate = data.gst_rate !== undefined
    ? roundCurrency(Number(data.gst_rate))
    : numberFromFinanceValue(orderline.gst_rate);
  const lineTaxableAmount = numberFromFinanceValue(orderline.taxable_amount);
  const lineCgstAmount = numberFromFinanceValue(orderline.cgst_amount);
  const lineSgstAmount = numberFromFinanceValue(orderline.sgst_amount);
  const lineIgstAmount = numberFromFinanceValue(orderline.igst_amount);
  const lineTotalGstAmount = numberFromFinanceValue(orderline.total_gst_amount);

  let taxableAmount = data.taxable_amount !== undefined
    ? roundCurrency(Number(data.taxable_amount))
    : lineTaxableAmount !== null
      ? roundCurrency(lineTaxableAmount * proportion)
      : null;

  let totalGstAmount = data.total_gst_amount !== undefined
    ? roundCurrency(Number(data.total_gst_amount))
    : lineTotalGstAmount !== null
      ? roundCurrency(lineTotalGstAmount * proportion)
      : null;

  if (taxableAmount === null && gstRate && gstRate > 0) {
    taxableAmount = roundCurrency(refundAmount / (1 + gstRate / 100));
  }
  if (totalGstAmount === null && taxableAmount !== null) {
    totalGstAmount = roundCurrency(Math.max(0, refundAmount - taxableAmount));
  }

  let cgstAmount = data.cgst_amount !== undefined
    ? roundCurrency(Number(data.cgst_amount))
    : lineCgstAmount !== null
      ? roundCurrency(lineCgstAmount * proportion)
      : null;
  let sgstAmount = data.sgst_amount !== undefined
    ? roundCurrency(Number(data.sgst_amount))
    : lineSgstAmount !== null
      ? roundCurrency(lineSgstAmount * proportion)
      : null;
  let igstAmount = data.igst_amount !== undefined
    ? roundCurrency(Number(data.igst_amount))
    : lineIgstAmount !== null
      ? roundCurrency(lineIgstAmount * proportion)
      : null;

  if (totalGstAmount !== null && cgstAmount === null && sgstAmount === null && igstAmount === null) {
    if ((lineIgstAmount || 0) > 0) {
      igstAmount = totalGstAmount;
    } else {
      cgstAmount = roundCurrency(totalGstAmount / 2);
      sgstAmount = roundCurrency(totalGstAmount - cgstAmount);
    }
  }

  return {
    taxableAmount,
    gstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGstAmount,
    hsnCode: data.hsn_code || orderline.hsn_code || orderline.product?.hsn_code || null,
  };
}
