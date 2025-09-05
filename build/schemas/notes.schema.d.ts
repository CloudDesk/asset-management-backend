import { z } from 'zod';
export declare const createNotesSchema: z.ZodObject<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateNotesSchema: z.ZodObject<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertNotesSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    quotenumber: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export declare const notesParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const notesQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    ispinned: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
    modifiedAfter: z.ZodOptional<z.ZodString>;
    modifiedBefore: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    quotenumber?: string | undefined;
    title?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    modifiedAfter?: string | undefined;
    modifiedBefore?: string | undefined;
    ispinned?: string | undefined;
}, {
    quotenumber?: string | undefined;
    title?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    modifiedAfter?: string | undefined;
    modifiedBefore?: string | undefined;
    ispinned?: string | undefined;
}>;
export type CreateNotesInput = z.infer<typeof createNotesSchema>;
export type UpdateNotesInput = z.infer<typeof updateNotesSchema>;
export type UpsertNotesInput = z.infer<typeof upsertNotesSchema>;
export type NotesParams = z.infer<typeof notesParamsSchema>;
export type NotesQuery = z.infer<typeof notesQuerySchema>;
//# sourceMappingURL=notes.schema.d.ts.map