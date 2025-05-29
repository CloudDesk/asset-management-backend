import { PicklistType } from '../config/dynamicFieldConfig.js';
export interface PicklistItem {
    id: number;
    label: string | null;
    value: string | null;
    object: string | null;
    controlledvalue: string | null;
    fieldname: string | null;
    controlledlabel: string | null;
    controlledfieldname: string | null;
    parent: string | null;
}
export declare function getPicklistItems(type: PicklistType, table?: string, field?: string): Promise<PicklistItem[]>;
export declare function validatePicklistValue(type: PicklistType, value: string, table?: string, field?: string): Promise<boolean>;
export declare function createPicklistItem(data: {
    type: PicklistType;
    table: string;
    field: string;
    label: string;
    value: string;
}): Promise<PicklistItem>;
export declare function updatePicklistItem(id: number, data: Partial<{
    label: string;
    value: string;
    object: string;
    fieldname: string;
}>): Promise<PicklistItem>;
export declare function deletePicklistItem(id: number): Promise<void>;
export declare function formatPicklistResponse(items: PicklistItem[]): {
    id: number;
    label: string | null;
    value: string | null;
    object: string | null;
    fieldname: string | null;
}[];
//# sourceMappingURL=picklistUtils.d.ts.map