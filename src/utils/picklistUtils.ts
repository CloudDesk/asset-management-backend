import { prisma } from '../models/prisma.js';
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

export async function getPicklistItems(
  type: PicklistType,
  table?: string,
  field?: string
): Promise<PicklistItem[]> {
  const where: any = { type, isActive: true };
  
  if (table) where.table = table;
  if (field) where.field = field;

  return await prisma.picklist.findMany({
    where,
    orderBy: [{ ordering: 'asc' }, { label: 'asc' }],
  });
}

export async function validatePicklistValue(
  type: PicklistType,
  value: string,
  table?: string,
  field?: string
): Promise<boolean> {
  const where: any = { type, value, isActive: true };
  
  if (table) where.table = table;
  if (field) where.field = field;

  const item = await prisma.picklist.findFirst({ where });
  return !!item;
}

export async function createPicklistItem(data: {
  type: PicklistType;
  table: string;
  field: string;
  label: string;
  value: string;
  ordering?: number;
}): Promise<PicklistItem> {
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

export async function updatePicklistItem(
  id: string,
  data: Partial<{
    label: string;
    value: string;
    isActive: boolean;
    ordering: number;
  }>
): Promise<PicklistItem> {
  return await prisma.picklist.update({
    where: { id },
    data,
  });
}

export async function deletePicklistItem(id: string): Promise<void> {
  await prisma.picklist.delete({
    where: { id },
  });
}

export function formatPicklistResponse(items: PicklistItem[]) {
  return items.map(item => ({
    id: item.id,
    label: item.label,
    value: item.value,
    isActive: item.isActive,
    ordering: item.ordering,
  }));
} 