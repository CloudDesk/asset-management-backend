import { z } from 'zod';
export declare const createPicklistSchema: z.ZodObject<{
    type: z.ZodEnum<[string, ...string[]]>;
    table: z.ZodString;
    field: z.ZodString;
    label: z.ZodString;
    value: z.ZodString;
    ordering: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    value: string;
    type: string;
    table: string;
    field: string;
    label: string;
    ordering: number;
}, {
    value: string;
    type: string;
    table: string;
    field: string;
    label: string;
    ordering?: number | undefined;
}>;
export declare const updatePicklistSchema: z.ZodObject<Omit<{
    type: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    table: z.ZodOptional<z.ZodString>;
    field: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    ordering: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "type">, "strip", z.ZodTypeAny, {
    value?: string | undefined;
    table?: string | undefined;
    field?: string | undefined;
    label?: string | undefined;
    ordering?: number | undefined;
}, {
    value?: string | undefined;
    table?: string | undefined;
    field?: string | undefined;
    label?: string | undefined;
    ordering?: number | undefined;
}>;
export declare const picklistParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const picklistQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    table: z.ZodOptional<z.ZodString>;
    field: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value?: string | undefined;
    type?: string | undefined;
    table?: string | undefined;
    field?: string | undefined;
    label?: string | undefined;
    isActive?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}, {
    value?: string | undefined;
    type?: string | undefined;
    table?: string | undefined;
    field?: string | undefined;
    label?: string | undefined;
    isActive?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}>;
export type CreatePicklistInput = z.infer<typeof createPicklistSchema>;
export type UpdatePicklistInput = z.infer<typeof updatePicklistSchema>;
export type PicklistParams = z.infer<typeof picklistParamsSchema>;
export type PicklistQuery = z.infer<typeof picklistQuerySchema>;
//# sourceMappingURL=picklist.schema.d.ts.map