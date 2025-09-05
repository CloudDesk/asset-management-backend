import { z } from 'zod';

// Poinvoice schema based on actual database fields from prisma schema
export const createPoinvoiceSchema = z.object({
  invoiceamount: z.number().optional(),
  ponumber: z.string().max(500).optional(),
  invoicedate: z.number().optional(),
  invoicenumber: z.string().max(500).optional(),
  invoiceurl: z.string().max(500).optional(),
  paymentdata: z.any().optional(), // JSON field
  createddate: z.number().optional(),
  modifieddate: z.number().optional(),
  balanceamount: z.number().optional(),
  iscreditpayment: z.boolean().optional(),
  paymentduedate: z.number().optional(),
  invoicestatus: z.string().max(100).optional(),
  pototal: z.number().optional(),
  purchaseorderstatus: z.string().max(500).optional(),
  transportationcharges: z.number().optional(),
  exchangeamount: z.number().optional(),
  customdutytaxamount: z.number().optional(),
  suppliertype: z.string().max(255).optional(),
  customdutychallanurl: z.string().max(255).optional(),
  billofentryurl: z.string().max(255).optional(),
}).passthrough();

export const updatePoinvoiceSchema = z.object({
  invoiceamount: z.number().optional(),
  ponumber: z.string().max(500).optional(),
  invoicedate: z.number().optional(),
  invoicenumber: z.string().max(500).optional(),
  invoiceurl: z.string().max(500).optional(),
  paymentdata: z.any().optional(), // JSON field
  modifieddate: z.number().optional(),
  balanceamount: z.number().optional(),
  iscreditpayment: z.boolean().optional(),
  paymentduedate: z.number().optional(),
  invoicestatus: z.string().max(100).optional(),
  pototal: z.number().optional(),
  purchaseorderstatus: z.string().max(500).optional(),
  transportationcharges: z.number().optional(),
  exchangeamount: z.number().optional(),
  customdutytaxamount: z.number().optional(),
  suppliertype: z.string().max(255).optional(),
  customdutychallanurl: z.string().max(255).optional(),
  billofentryurl: z.string().max(255).optional(),
}).passthrough();

export const upsertPoinvoiceSchema = z.object({
  id: z.string().optional(),
  invoiceamount: z.number().optional(),
  ponumber: z.string().max(500).optional(),
  invoicedate: z.number().optional(),
  invoicenumber: z.string().max(500).optional(),
  invoiceurl: z.string().max(500).optional(),
  paymentdata: z.any().optional(), // JSON field
  createddate: z.number().optional(),
  modifieddate: z.number().optional(),
  balanceamount: z.number().optional(),
  iscreditpayment: z.boolean().optional(),
  paymentduedate: z.number().optional(),
  invoicestatus: z.string().max(100).optional(),
  pototal: z.number().optional(),
  purchaseorderstatus: z.string().max(500).optional(),
  transportationcharges: z.number().optional(),
  exchangeamount: z.number().optional(),
  customdutytaxamount: z.number().optional(),
  suppliertype: z.string().max(255).optional(),
  customdutychallanurl: z.string().max(255).optional(),
  billofentryurl: z.string().max(255).optional(),
}).passthrough();

export const poinvoiceParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreatePoinvoiceInput = z.infer<typeof createPoinvoiceSchema>;
export type UpdatePoinvoiceInput = z.infer<typeof updatePoinvoiceSchema>;
export type UpsertPoinvoiceInput = z.infer<typeof upsertPoinvoiceSchema>;
export type PoinvoiceParams = z.infer<typeof poinvoiceParamsSchema>; 
