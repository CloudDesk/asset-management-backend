import { prisma } from '../models/prisma.js';
export async function getPicklistItems(type, table, field) {
    const where = {};
    if (table)
        where.object = table;
    if (field)
        where.fieldname = field;
    return await prisma.picklist.findMany({
        where,
        orderBy: [{ label: 'asc' }],
    });
}
export async function validatePicklistValue(type, value, table, field) {
    const where = { value };
    if (table)
        where.object = table;
    if (field)
        where.fieldname = field;
    const item = await prisma.picklist.findFirst({ where });
    return !!item;
}
export async function createPicklistItem(data) {
    return await prisma.picklist.create({
        data: {
            object: data.table,
            fieldname: data.field,
            label: data.label,
            value: data.value,
        },
    });
}
export async function updatePicklistItem(id, data) {
    return await prisma.picklist.update({
        where: { id },
        data,
    });
}
export async function deletePicklistItem(id) {
    await prisma.picklist.delete({
        where: { id },
    });
}
export function formatPicklistResponse(items) {
    return items.map(item => ({
        id: item.id,
        label: item.label,
        value: item.value,
        object: item.object,
        fieldname: item.fieldname,
    }));
}
//# sourceMappingURL=picklistUtils.js.map