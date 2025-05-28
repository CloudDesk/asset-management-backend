import { prisma } from '../models/prisma.js';
export async function getPicklistItems(type, table, field) {
    const where = { type, isActive: true };
    if (table)
        where.table = table;
    if (field)
        where.field = field;
    return await prisma.picklist.findMany({
        where,
        orderBy: [{ ordering: 'asc' }, { label: 'asc' }],
    });
}
export async function validatePicklistValue(type, value, table, field) {
    const where = { type, value, isActive: true };
    if (table)
        where.table = table;
    if (field)
        where.field = field;
    const item = await prisma.picklist.findFirst({ where });
    return !!item;
}
export async function createPicklistItem(data) {
    // Get the next ordering value if not provided
    if (data.ordering === undefined) {
        const lastItem = await prisma.picklist.findFirst({
            where: { type: data.type, table: data.table, field: data.field },
            orderBy: { ordering: 'desc' },
        });
        data.ordering = (lastItem?.ordering || 0) + 1;
    }
    return await prisma.picklist.create({
        data: {
            type: data.type,
            table: data.table,
            field: data.field,
            label: data.label,
            value: data.value,
            ordering: data.ordering,
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
        isActive: item.isActive,
        ordering: item.ordering,
    }));
}
//# sourceMappingURL=picklistUtils.js.map