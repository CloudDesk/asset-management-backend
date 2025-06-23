import { z } from 'zod';
export declare const createPromotionalAssetSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodEnum<["banner", "featured_ad", "popup", "carousel"]>;
    placement: z.ZodString;
    title: z.ZodString;
    content: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>;
    priority: z.ZodDefault<z.ZodNumber>;
    is_active: z.ZodDefault<z.ZodBoolean>;
    schedule_start: z.ZodOptional<z.ZodString>;
    schedule_end: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "banner" | "featured_ad" | "popup" | "carousel";
    placement: string;
    title: string;
    content: Record<string, any>;
    priority: number;
    is_active: boolean;
    schedule_start?: string | undefined;
    schedule_end?: string | undefined;
}, {
    type: "banner" | "featured_ad" | "popup" | "carousel";
    placement: string;
    title: string;
    content: Record<string, any>;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    schedule_start?: string | undefined;
    schedule_end?: string | undefined;
}>, {
    type: "banner" | "featured_ad" | "popup" | "carousel";
    placement: string;
    title: string;
    content: Record<string, any>;
    priority: number;
    is_active: boolean;
    schedule_start?: string | undefined;
    schedule_end?: string | undefined;
}, {
    type: "banner" | "featured_ad" | "popup" | "carousel";
    placement: string;
    title: string;
    content: Record<string, any>;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    schedule_start?: string | undefined;
    schedule_end?: string | undefined;
}>;
export declare const updatePromotionalAssetSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<["banner", "featured_ad", "popup", "carousel"]>>;
    placement: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>>;
    priority: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    is_active: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    schedule_start: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    schedule_end: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    version: number;
    type?: "banner" | "featured_ad" | "popup" | "carousel" | undefined;
    placement?: string | undefined;
    title?: string | undefined;
    content?: Record<string, any> | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    schedule_start?: string | undefined;
    schedule_end?: string | undefined;
}, {
    version: number;
    type?: "banner" | "featured_ad" | "popup" | "carousel" | undefined;
    placement?: string | undefined;
    title?: string | undefined;
    content?: Record<string, any> | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    schedule_start?: string | undefined;
    schedule_end?: string | undefined;
}>, {
    version: number;
    type?: "banner" | "featured_ad" | "popup" | "carousel" | undefined;
    placement?: string | undefined;
    title?: string | undefined;
    content?: Record<string, any> | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    schedule_start?: string | undefined;
    schedule_end?: string | undefined;
}, {
    version: number;
    type?: "banner" | "featured_ad" | "popup" | "carousel" | undefined;
    placement?: string | undefined;
    title?: string | undefined;
    content?: Record<string, any> | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    schedule_start?: string | undefined;
    schedule_end?: string | undefined;
}>;
export declare const promotionalAssetParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const promotionalAssetQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["banner", "featured_ad", "popup", "carousel"]>>;
    placement: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodString>;
    schedule_active: z.ZodOptional<z.ZodString>;
    priority_min: z.ZodOptional<z.ZodString>;
    priority_max: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["banner", "featured_ad", "popup", "carousel"]>>;
    placement: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodString>;
    schedule_active: z.ZodOptional<z.ZodString>;
    priority_min: z.ZodOptional<z.ZodString>;
    priority_max: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["banner", "featured_ad", "popup", "carousel"]>>;
    placement: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodString>;
    schedule_active: z.ZodOptional<z.ZodString>;
    priority_min: z.ZodOptional<z.ZodString>;
    priority_max: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const auditLogQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page?: string | undefined;
    limit?: string | undefined;
}, {
    page?: string | undefined;
    limit?: string | undefined;
}>;
export type CreatePromotionalAssetInput = z.infer<typeof createPromotionalAssetSchema>;
export type UpdatePromotionalAssetInput = z.infer<typeof updatePromotionalAssetSchema>;
export type PromotionalAssetParams = z.infer<typeof promotionalAssetParamsSchema>;
export type PromotionalAssetQuery = z.infer<typeof promotionalAssetQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
//# sourceMappingURL=promotional-assets.schema.d.ts.map