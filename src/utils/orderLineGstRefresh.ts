import type { GstCalculationResult, GstTypeResult } from '../services/gst.service.js';

/**
 * GST is calculated while the order is created, before createOrderAfterPayment
 * spreads a direct coupon onto the order lines. A line whose amount changed
 * afterwards still carries GST on the amount before the coupon (order 178:
 * taxable + GST = 3,395 for lines worth 3,345). This works out which lines to
 * recalculate, reusing the GST type the order already got (no second EKART
 * lookup, so CGST+SGST cannot flip to IGST), and the new order totals.
 *
 * Lines without GST yet are left to the existing reconciliation, and a line
 * whose taxable + GST already equals its amount is not touched (wallet orders,
 * orders without a coupon).
 */
export interface GstRefreshLine {
  id: number;
  orderamount: number;
  gst_rate: number | null;
  hsn_code: string | null;
  taxable_amount: number | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  igst_amount: number | null;
  total_gst_amount: number | null;
}

export interface GstRefreshPlan {
  lines: Array<{ id: number; gst: GstCalculationResult }>;
  totals: {
    total_taxable_amount: number;
    total_cgst_amount: number;
    total_sgst_amount: number;
    total_igst_amount: number;
    total_gst_amount: number;
  };
}

const round = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const num = (value: number | null): number => Number(value ?? 0) || 0;

export function gstTypeFromLines(lines: GstRefreshLine[]): GstTypeResult | undefined {
  if (lines.some((line) => num(line.cgst_amount) > 0 || num(line.sgst_amount) > 0)) {
    return { gst_type: 'INTRA-STATE', cgst: true, sgst: true, igst: false, fromState: null, toState: null };
  }
  if (lines.some((line) => num(line.igst_amount) > 0)) {
    return { gst_type: 'INTER-STATE', cgst: false, sgst: false, igst: true, fromState: null, toState: null };
  }
  return undefined;
}

export function planOrderLineGstRefresh(
  lines: GstRefreshLine[],
  calculate: (orderamount: number, gstRate: number, gstType: GstTypeResult) => GstCalculationResult,
): GstRefreshPlan | undefined {
  const stale = lines.filter((line) =>
    line.taxable_amount !== null &&
    line.gst_rate !== null &&
    Math.abs(round(num(line.taxable_amount) + num(line.total_gst_amount)) - round(num(line.orderamount))) > 0.01);
  if (!stale.length) return undefined;
  // With only 0% lines there is no tax to split, so the type does not matter.
  const gstType = gstTypeFromLines(lines)
    ?? (stale.every((line) => num(line.gst_rate) === 0)
      ? { gst_type: 'INTER-STATE' as const, cgst: false, sgst: false, igst: true, fromState: null, toState: null }
      : undefined);
  if (!gstType) return undefined;

  const refreshed = new Map(stale.map((line) => [line.id, {
    ...calculate(Math.max(0, num(line.orderamount)), num(line.gst_rate), gstType),
    hsn_code: line.hsn_code,
  }]));
  const after = lines.map((line) => refreshed.get(line.id) ?? {
    taxable_amount: num(line.taxable_amount),
    cgst_amount: num(line.cgst_amount),
    sgst_amount: num(line.sgst_amount),
    igst_amount: num(line.igst_amount),
    total_gst_amount: num(line.total_gst_amount),
  });
  const sum = (key: 'taxable_amount' | 'cgst_amount' | 'sgst_amount' | 'igst_amount' | 'total_gst_amount') =>
    round(after.reduce((total, item) => total + item[key], 0));
  return {
    lines: [...refreshed].map(([id, gst]) => ({ id, gst })),
    totals: {
      total_taxable_amount: sum('taxable_amount'),
      total_cgst_amount: sum('cgst_amount'),
      total_sgst_amount: sum('sgst_amount'),
      total_igst_amount: sum('igst_amount'),
      total_gst_amount: sum('total_gst_amount'),
    },
  };
}
