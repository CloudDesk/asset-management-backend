import { z } from 'zod';
export declare const stockImportCommitRowSchema: z.ZodObject<{
    rowNumber: z.ZodOptional<z.ZodNumber>;
    puc: z.ZodOptional<z.ZodString>;
    rfid: z.ZodString;
    serialnumber: z.ZodString;
    manufacturedyear: z.ZodOptional<z.ZodNumber>;
    releaseyear: z.ZodOptional<z.ZodNumber>;
    ecompublish: z.ZodOptional<z.ZodBoolean>;
    location: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    serialnumber: string;
    rfid: string;
    puc?: string | undefined;
    location?: string | undefined;
    manufacturedyear?: number | undefined;
    releaseyear?: number | undefined;
    ecompublish?: boolean | undefined;
    rowNumber?: number | undefined;
}, {
    serialnumber: string;
    rfid: string;
    puc?: string | undefined;
    location?: string | undefined;
    manufacturedyear?: number | undefined;
    releaseyear?: number | undefined;
    ecompublish?: boolean | undefined;
    rowNumber?: number | undefined;
}>;
export declare const stockImportCommitSchema: z.ZodObject<{
    rows: z.ZodArray<z.ZodObject<{
        rowNumber: z.ZodOptional<z.ZodNumber>;
        puc: z.ZodOptional<z.ZodString>;
        rfid: z.ZodString;
        serialnumber: z.ZodString;
        manufacturedyear: z.ZodOptional<z.ZodNumber>;
        releaseyear: z.ZodOptional<z.ZodNumber>;
        ecompublish: z.ZodOptional<z.ZodBoolean>;
        location: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        serialnumber: string;
        rfid: string;
        puc?: string | undefined;
        location?: string | undefined;
        manufacturedyear?: number | undefined;
        releaseyear?: number | undefined;
        ecompublish?: boolean | undefined;
        rowNumber?: number | undefined;
    }, {
        serialnumber: string;
        rfid: string;
        puc?: string | undefined;
        location?: string | undefined;
        manufacturedyear?: number | undefined;
        releaseyear?: number | undefined;
        ecompublish?: boolean | undefined;
        rowNumber?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    rows: {
        serialnumber: string;
        rfid: string;
        puc?: string | undefined;
        location?: string | undefined;
        manufacturedyear?: number | undefined;
        releaseyear?: number | undefined;
        ecompublish?: boolean | undefined;
        rowNumber?: number | undefined;
    }[];
}, {
    rows: {
        serialnumber: string;
        rfid: string;
        puc?: string | undefined;
        location?: string | undefined;
        manufacturedyear?: number | undefined;
        releaseyear?: number | undefined;
        ecompublish?: boolean | undefined;
        rowNumber?: number | undefined;
    }[];
}>;
export type StockImportCommitRow = z.infer<typeof stockImportCommitRowSchema>;
export type StockImportCommitInput = z.infer<typeof stockImportCommitSchema>;
//# sourceMappingURL=stock-import.schema.d.ts.map