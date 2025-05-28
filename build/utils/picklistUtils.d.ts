import { PicklistType } from '../config/dynamicFieldConfig.js';
export interface PicklistItem {
    id: string;
    type: string;
    table: string;
    field: string;
    label: string;
    value: string;
    isActive: boolean;
    ordering: number;
}
export declare function getPicklistItems(type: PicklistType, table?: string, field?: string): Promise<PicklistItem[]>;
export declare function validatePicklistValue(type: PicklistType, value: string, table?: string, field?: string): Promise<boolean>;
export declare function createPicklistItem(data: {
    type: PicklistType;
    table: string;
    field: string;
    label: string;
    value: string;
    ordering?: number;
}): Promise<PicklistItem>;
export declare function updatePicklistItem(id: string, data: Partial<{
    label: string;
    value: string;
    isActive: boolean;
    ordering: number;
}>): Promise<PicklistItem>;
export declare function deletePicklistItem(id: string): Promise<void>;
export declare function formatPicklistResponse(items: PicklistItem[]): {
    id: string;
    label: string;
    value: string;
    isActive: boolean;
    ordering: number;
}[];
//# sourceMappingURL=picklistUtils.d.ts.map