import { z } from 'zod';

// Address schema based on actual database fields from prisma schema  
export const createAddressSchema = z.object({
  userid: z.number().optional(),
  name: z.string().trim().min(2, 'Name is required').max(100),
  mobilenumber: z.number().optional(),
  pincode: z.number().optional(),
  doornumber: z.string().max(100).optional(),
  address: z.string().optional(),
  landmark: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  modifieddate: z.number().optional(),
  createddate: z.number().optional(),
  isdefaultaddress: z.boolean().optional().default(false),
}).passthrough();

export const updateAddressSchema = z.object({
  userid: z.number().optional(),
  name: z.string().trim().min(2, 'Name is required').max(100).optional(),
  mobilenumber: z.number().optional(),
  pincode: z.number().optional(),
  doornumber: z.string().max(100).optional(),
  address: z.string().optional(),
  landmark: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  modifieddate: z.number().optional(),
  isdefaultaddress: z.boolean().optional(),
}).passthrough();

export const upsertAddressSchema = z.object({
  id: z.string().optional(),
  userid: z.number().optional(),
  name: z.string().trim().min(2, 'Name is required').max(100),
  mobilenumber: z.number().optional(),
  pincode: z.number().optional(),
  doornumber: z.string().max(100).optional(),
  address: z.string().optional(),
  landmark: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  modifieddate: z.number().optional(),
  createddate: z.number().optional(),
  isdefaultaddress: z.boolean().optional().default(false),
}).passthrough();

export const addressParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type UpsertAddressInput = z.infer<typeof upsertAddressSchema>;
export type AddressParams = z.infer<typeof addressParamsSchema>;
