import { prisma } from '../models/prisma.js';
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

export async function getPicklistItems(
  type: PicklistType,
  table?: string,
  field?: string
): Promise<PicklistItem[]> {
  const where: any = {};
  
  if (table) where.object = table;
  if (field) where.fieldname = field;

  return await prisma.picklist.findMany({
    where,
    orderBy: [{ label: 'asc' }],
  });
}

export async function validatePicklistValue(
  type: PicklistType,
  value: string,
  table?: string,
  field?: string
): Promise<boolean> {
  const where: any = { value };
  
  if (table) where.object = table;
  if (field) where.fieldname = field;

  const item = await prisma.picklist.findFirst({ where });
  return !!item;
}

export async function createPicklistItem(data: {
  type: PicklistType;
  table: string;
  field: string;
  label: string;
  value: string;
}): Promise<PicklistItem> {
  return await prisma.picklist.create({
    data: {
      object: data.table,
      fieldname: data.field,
      label: data.label,
      value: data.value,
    },
  });
}

export async function updatePicklistItem(
  id: number,
  data: Partial<{
    label: string;
    value: string;
    object: string;
    fieldname: string;
  }>
): Promise<PicklistItem> {
  return await prisma.picklist.update({
    where: { id },
    data,
  });
}

export async function deletePicklistItem(id: number): Promise<void> {
  await prisma.picklist.delete({
    where: { id },
  });
}

export function formatPicklistResponse(items: PicklistItem[]) {
  return items.map(item => ({
    id: item.id,
    label: item.label,
    value: item.value,
    object: item.object,
    fieldname: item.fieldname,
  }));
} 