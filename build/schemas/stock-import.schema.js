import { z } from 'zod';
export const stockImportCommitRowSchema = z.object({
    rowNumber: z.number().int().positive().optional(),
    puc: z.string().trim().min(1).optional(),
    rfid: z.string().trim().min(1, 'RFID is required'),
    serialnumber: z.string().trim().min(1, 'Serial Number is required'),
    manufacturedyear: z.number().int().nonnegative().optional(),
    releaseyear: z.number().int().nonnegative().optional(),
    ecompublish: z.boolean().optional(),
    location: z.string().trim().min(1).optional(),
});
export const stockImportCommitSchema = z.object({
    rows: z
        .array(stockImportCommitRowSchema)
        .min(1, 'At least one row must be provided for import commit'),
});
//# sourceMappingURL=stock-import.schema.js.map