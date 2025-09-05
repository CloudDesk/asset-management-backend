import { z } from 'zod';
export declare const createPicklistSchema: z.ZodObject<{
    label: z.ZodString;
    value: z.ZodString;
    object: z.ZodOptional<z.ZodString>;
    controlledvalue: z.ZodOptional<z.ZodString>;
    fieldname: z.ZodOptional<z.ZodString>;
    controlledlabel: z.ZodOptional<z.ZodString>;
    controlledfieldname: z.ZodOptional<z.ZodString>;
    parent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    label: string;
    object?: string | undefined;
    controlledvalue?: string | undefined;
    fieldname?: string | undefined;
    controlledlabel?: string | undefined;
    controlledfieldname?: string | undefined;
    parent?: string | undefined;
}, {
    value: string;
    label: string;
    object?: string | undefined;
    controlledvalue?: string | undefined;
    fieldname?: string | undefined;
    controlledlabel?: string | undefined;
    controlledfieldname?: string | undefined;
    parent?: string | undefined;
}>;
export declare const updatePicklistSchema: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    object: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    controlledvalue: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    fieldname: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    controlledlabel: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    controlledfieldname: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    parent: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    object?: string | undefined;
    value?: string | undefined;
    label?: string | undefined;
    controlledvalue?: string | undefined;
    fieldname?: string | undefined;
    controlledlabel?: string | undefined;
    controlledfieldname?: string | undefined;
    parent?: string | undefined;
}, {
    object?: string | undefined;
    value?: string | undefined;
    label?: string | undefined;
    controlledvalue?: string | undefined;
    fieldname?: string | undefined;
    controlledlabel?: string | undefined;
    controlledfieldname?: string | undefined;
    parent?: string | undefined;
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
    label: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    object: z.ZodOptional<z.ZodString>;
    controlledvalue: z.ZodOptional<z.ZodString>;
    fieldname: z.ZodOptional<z.ZodString>;
    controlledlabel: z.ZodOptional<z.ZodString>;
    controlledfieldname: z.ZodOptional<z.ZodString>;
    parent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    object?: string | undefined;
    value?: string | undefined;
    label?: string | undefined;
    controlledvalue?: string | undefined;
    fieldname?: string | undefined;
    controlledlabel?: string | undefined;
    controlledfieldname?: string | undefined;
    parent?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}, {
    object?: string | undefined;
    value?: string | undefined;
    label?: string | undefined;
    controlledvalue?: string | undefined;
    fieldname?: string | undefined;
    controlledlabel?: string | undefined;
    controlledfieldname?: string | undefined;
    parent?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}>;
export type CreatePicklistInput = z.infer<typeof createPicklistSchema>;
export type UpdatePicklistInput = z.infer<typeof updatePicklistSchema>;
export type PicklistParams = z.infer<typeof picklistParamsSchema>;
export type PicklistQuery = z.infer<typeof picklistQuerySchema>;
//# sourceMappingURL=picklist.schema.d.ts.map