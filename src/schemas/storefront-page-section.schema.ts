import { z } from 'zod';

const buttonSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.string().min(1).max(1000),
  variant: z.string().max(80).optional(),
}).passthrough();

const mediaSchema = z.object({
  type: z.enum(['image', 'video']).default('image'),
  desktop_url: z.string().min(1).max(2000),
  mobile_url: z.string().max(2000).optional(),
  poster_url: z.string().max(2000).optional(),
  fit: z.enum(['cover', 'contain']).default('cover'),
  alt: z.string().max(500).optional(),
}).passthrough();

const heroSlideSchema = z.object({
  sort_order: z.number().int().min(0).default(0),
  eyebrow: z.string().max(255).optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  button: buttonSchema.optional(),
  buttons: z.array(buttonSchema).optional(),
  media: mediaSchema,
}).passthrough();

const showcaseItemSchema = z.object({
  sort_order: z.number().int().min(0).default(0),
  eyebrow: z.string().max(255).optional(),
  title: z.string().min(1).max(255),
  media: mediaSchema,
}).passthrough();

export const storefrontAttributesSchema = z.object({
  autoplay: z.boolean().optional(),
  interval_ms: z.number().int().min(1000).max(60000).optional(),
  layout: z.string().max(120).optional(),
  slides: z.array(heroSlideSchema).optional(),
  items: z.array(showcaseItemSchema).optional(),
}).passthrough();

const nullableDateSchema = z
  .union([z.string().datetime(), z.string().length(0), z.null()])
  .optional();

export const createStorefrontPageSectionSchema = z.object({
  page_key: z.string().min(1).max(80).default('home').optional(),
  section_key: z.string().min(1).max(120),
  section_type: z.string().min(1).max(80),
  name: z.string().min(1).max(255),
  attributes: storefrontAttributesSchema.default({}).optional(),
  sort_order: z.number().int().min(0).default(0).optional(),
  is_active: z.boolean().default(true).optional(),
  schedule_start: nullableDateSchema,
  schedule_end: nullableDateSchema,
  createdby: z.number().int().optional().nullable(),
  modifiedby: z.number().int().optional().nullable(),
}).strict();

export const updateStorefrontPageSectionSchema = createStorefrontPageSectionSchema
  .partial()
  .extend({
    version: z.number().int().min(1).optional(),
  })
  .strict();

export const storefrontPageSectionParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a valid integer'),
});

export const storefrontPageSectionQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  page_key: z.string().optional(),
  section_key: z.string().optional(),
  section_type: z.string().optional(),
  is_active: z.string().optional(),
  search: z.string().optional(),
});

export type CreateStorefrontPageSectionInput = z.infer<typeof createStorefrontPageSectionSchema>;
export type UpdateStorefrontPageSectionInput = z.infer<typeof updateStorefrontPageSectionSchema>;
export type StorefrontPageSectionParams = z.infer<typeof storefrontPageSectionParamsSchema>;
export type StorefrontPageSectionQuery = z.infer<typeof storefrontPageSectionQuerySchema>;
