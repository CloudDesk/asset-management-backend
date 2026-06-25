import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { createPaginationResult, getPrismaSkipTake, PaginationResult } from '../utils/pagination.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';
import {
  CreateStorefrontPageSectionInput,
  UpdateStorefrontPageSectionInput,
} from '../schemas/storefront-page-section.schema.js';

type StorefrontSectionRecord = {
  id: bigint;
  page_key: string;
  section_key: string;
  section_type: string;
  name: string;
  attributes: Prisma.JsonValue;
  sort_order: number;
  is_active: boolean;
  schedule_start: Date | null;
  schedule_end: Date | null;
  version: number;
  createdby: number | null;
  modifiedby: number | null;
  createddate: bigint | null;
  modifieddate: bigint | null;
};

type StorefrontPageSectionFilters = {
  page_key?: string;
  section_key?: string;
  section_type?: string;
  is_active?: boolean;
  search?: string;
};

const parseOptionalDate = (value?: string | null) => {
  if (!value) return null;
  return new Date(value);
};

const serializeSection = (section: StorefrontSectionRecord) => ({
  ...section,
  id: Number(section.id),
  createddate: section.createddate === null ? null : Number(section.createddate),
  modifieddate: section.modifieddate === null ? null : Number(section.modifieddate),
  schedule_start: section.schedule_start ? section.schedule_start.toISOString() : null,
  schedule_end: section.schedule_end ? section.schedule_end.toISOString() : null,
});

const orderNestedItems = (attributes: Prisma.JsonValue): Prisma.JsonValue => {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return attributes;
  }

  const value = { ...(attributes as Record<string, unknown>) };
  for (const key of ['slides', 'items']) {
    const nested = value[key];
    if (Array.isArray(nested)) {
      value[key] = [...nested].sort((a, b) => {
        const aOrder = typeof a === 'object' && a !== null && 'sort_order' in a ? Number((a as any).sort_order) : 0;
        const bOrder = typeof b === 'object' && b !== null && 'sort_order' in b ? Number((b as any).sort_order) : 0;
        return aOrder - bOrder;
      });
    }
  }

  return value as Prisma.JsonValue;
};

const validateSchedule = (start?: string | null, end?: string | null) => {
  if (!start || !end) return;

  if (new Date(start).getTime() >= new Date(end).getTime()) {
    throw new ValidationError('Schedule end must be after schedule start');
  }
};

export class StorefrontPageSectionService {
  async findMany(
    filters: StorefrontPageSectionFilters,
    page: number,
    limit: number
  ): Promise<PaginationResult<ReturnType<typeof serializeSection>>> {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where: Prisma.StorefrontPageSectionWhereInput = {};

    if (filters.page_key) where.page_key = filters.page_key;
    if (filters.section_key) where.section_key = filters.section_key;
    if (filters.section_type) where.section_type = filters.section_type;
    if (filters.is_active !== undefined) where.is_active = filters.is_active;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { section_key: { contains: filters.search, mode: 'insensitive' } },
        { section_type: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [sections, total] = await Promise.all([
      prisma.storefrontPageSection.findMany({
        where,
        skip,
        take,
        orderBy: [
          { page_key: 'asc' },
          { sort_order: 'asc' },
          { id: 'asc' },
        ],
      }),
      prisma.storefrontPageSection.count({ where }),
    ]);

    return createPaginationResult(
      sections.map((section) => serializeSection({
        ...(section as StorefrontSectionRecord),
        attributes: orderNestedItems(section.attributes),
      })),
      total,
      page,
      limit
    );
  }

  async findById(id: string) {
    const section = await prisma.storefrontPageSection.findUnique({
      where: { id: BigInt(id) },
    });

    if (!section) {
      throw new NotFoundError('Storefront page section not found');
    }

    return serializeSection({
      ...(section as StorefrontSectionRecord),
      attributes: orderNestedItems(section.attributes),
    });
  }

  async getActivePageConfig(pageKey = 'home') {
    const now = new Date();
    const sections = await prisma.storefrontPageSection.findMany({
      where: {
        page_key: pageKey,
        is_active: true,
        AND: [
          { OR: [{ schedule_start: null }, { schedule_start: { lte: now } }] },
          { OR: [{ schedule_end: null }, { schedule_end: { gte: now } }] },
        ],
      },
      orderBy: [
        { sort_order: 'asc' },
        { id: 'asc' },
      ],
    });

    const formatted = sections.map((section) => serializeSection({
      ...(section as StorefrontSectionRecord),
      attributes: orderNestedItems(section.attributes),
    }));

    return {
      page_key: pageKey,
      sections: formatted,
      sections_by_key: formatted.reduce<Record<string, typeof formatted>>((acc, section) => {
        if (!acc[section.section_key]) acc[section.section_key] = [];
        acc[section.section_key]!.push(section);
        return acc;
      }, {}),
    };
  }

  async create(data: CreateStorefrontPageSectionInput) {
    validateSchedule(data.schedule_start, data.schedule_end);
    const timestamp = BigInt(Date.now());

    const section = await prisma.storefrontPageSection.create({
      data: {
        page_key: data.page_key || 'home',
        section_key: data.section_key,
        section_type: data.section_type,
        name: data.name,
        attributes: (data.attributes || {}) as Prisma.InputJsonValue,
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
        schedule_start: parseOptionalDate(data.schedule_start),
        schedule_end: parseOptionalDate(data.schedule_end),
        version: 1,
        createdby: data.createdby ?? null,
        modifiedby: data.modifiedby ?? data.createdby ?? null,
        createddate: timestamp,
        modifieddate: timestamp,
      },
    });

    return serializeSection(section as StorefrontSectionRecord);
  }

  async update(id: string, data: UpdateStorefrontPageSectionInput) {
    const existing = await prisma.storefrontPageSection.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new NotFoundError('Storefront page section not found');
    }

    const nextScheduleStart =
      data.schedule_start === undefined
        ? existing.schedule_start?.toISOString() ?? null
        : data.schedule_start;
    const nextScheduleEnd =
      data.schedule_end === undefined
        ? existing.schedule_end?.toISOString() ?? null
        : data.schedule_end;
    validateSchedule(nextScheduleStart, nextScheduleEnd);

    if (data.version !== undefined && data.version !== existing.version) {
      throw new ValidationError('Section was modified by another update', 'Refresh and try again with the latest version.');
    }

    const updateData: Prisma.StorefrontPageSectionUpdateInput = {
      modifieddate: BigInt(Date.now()),
      version: { increment: 1 },
    };

    if (data.page_key !== undefined) updateData.page_key = data.page_key;
    if (data.section_key !== undefined) updateData.section_key = data.section_key;
    if (data.section_type !== undefined) updateData.section_type = data.section_type;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.attributes !== undefined) updateData.attributes = data.attributes as Prisma.InputJsonValue;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.schedule_start !== undefined) updateData.schedule_start = parseOptionalDate(data.schedule_start);
    if (data.schedule_end !== undefined) updateData.schedule_end = parseOptionalDate(data.schedule_end);
    if (data.modifiedby !== undefined) updateData.modifiedby = data.modifiedby;

    const section = await prisma.storefrontPageSection.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    return serializeSection({
      ...(section as StorefrontSectionRecord),
      attributes: orderNestedItems(section.attributes),
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.storefrontPageSection.delete({
      where: { id: BigInt(id) },
    });
  }
}
