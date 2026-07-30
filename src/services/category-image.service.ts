import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';
import { CategoryImageQuery, UpdateCategoryImageInput } from '../schemas/category-image.schema.js';

const ALLOWED_FIELDNAMES = ['category', 'subcategory'] as const;

type CategoryImageWriteInput = {
  imageurl: string;
  objectkey: string;
  thumbnailurl?: string | null;
  thumbnailkey?: string | null;
  bucket: string;
  alttext?: string | null;
  width?: number | null;
  height?: number | null;
  filesize?: number | null;
  mimetype?: string | null;
  userid?: number | null;
};

const serializeImage = (image: any) => {
  if (!image) return null;

  return {
    ...image,
    createddate: image.createddate === null ? null : Number(image.createddate),
    modifieddate: image.modifieddate === null ? null : Number(image.modifieddate),
  };
};

const serializePicklistWithImage = (picklist: any) => ({
  id: picklist.id,
  label: picklist.label,
  value: picklist.value,
  object: picklist.object,
  fieldname: picklist.fieldname,
  parent: picklist.parent,
  controlledvalue: picklist.controlledvalue,
  sortorder: picklist.sortorder,
  isactive: picklist.isactive,
  image: serializeImage(picklist.categoryImage),
});

export class CategoryImageService {
  async list(query: CategoryImageQuery) {
    const where: Prisma.PicklistWhereInput = {
      object: 'product',
      fieldname: query.fieldname || { in: [...ALLOWED_FIELDNAMES] },
    };

    if (query.search) {
      where.OR = [
        { label: { contains: query.search, mode: 'insensitive' } },
        { value: { contains: query.search, mode: 'insensitive' } },
        { parent: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isactive !== undefined) {
      where.categoryImage = {
        is: {
          isactive: query.isactive === 'true',
        },
      };
    }

    const records = await prisma.picklist.findMany({
      where,
      include: {
        categoryImage: true,
      },
      orderBy: [
        { fieldname: 'asc' },
        { parent: 'asc' },
        { sortorder: 'asc' },
        { label: 'asc' },
      ],
    });

    return records.map(serializePicklistWithImage);
  }

  async getByPicklistId(picklistId: number) {
    const picklist = await prisma.picklist.findUnique({
      where: { id: picklistId },
      include: {
        categoryImage: true,
      },
    });

    if (!picklist) {
      throw new NotFoundError('Category or subcategory picklist not found');
    }

    if (
      picklist.object !== 'product' ||
      !picklist.fieldname ||
      !ALLOWED_FIELDNAMES.includes(picklist.fieldname as typeof ALLOWED_FIELDNAMES[number])
    ) {
      throw new ValidationError(
        'Images can only be managed for product category and subcategory picklists'
      );
    }

    return serializePicklistWithImage(picklist);
  }

  async upsertImage(picklistId: number, input: CategoryImageWriteInput) {
    const picklist = await this.getByPicklistId(picklistId);
    const timestamp = BigInt(Date.now());

    const image = await prisma.categoryImage.upsert({
      where: { picklistid: picklistId },
      create: {
        picklistid: picklistId,
        imageurl: input.imageurl,
        objectkey: input.objectkey,
        thumbnailurl: input.thumbnailurl ?? null,
        thumbnailkey: input.thumbnailkey ?? null,
        bucket: input.bucket,
        alttext: input.alttext ?? picklist.label ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        filesize: input.filesize ?? null,
        mimetype: input.mimetype ?? null,
        isactive: true,
        createdby: input.userid ?? null,
        modifiedby: input.userid ?? null,
        createddate: timestamp,
        modifieddate: timestamp,
      },
      update: {
        imageurl: input.imageurl,
        objectkey: input.objectkey,
        thumbnailurl: input.thumbnailurl ?? null,
        thumbnailkey: input.thumbnailkey ?? null,
        bucket: input.bucket,
        ...(input.alttext !== undefined ? { alttext: input.alttext } : {}),
        width: input.width ?? null,
        height: input.height ?? null,
        filesize: input.filesize ?? null,
        mimetype: input.mimetype ?? null,
        isactive: true,
        modifiedby: input.userid ?? null,
        modifieddate: timestamp,
      },
    });

    return {
      ...picklist,
      image: serializeImage(image),
    };
  }

  async updateMetadata(
    picklistId: number,
    input: UpdateCategoryImageInput,
    userid?: number
  ) {
    await this.getByPicklistId(picklistId);

    const existing = await prisma.categoryImage.findUnique({
      where: { picklistid: picklistId },
    });

    if (!existing) {
      throw new NotFoundError('No image has been configured for this picklist');
    }

    const image = await prisma.categoryImage.update({
      where: { picklistid: picklistId },
      data: {
        ...(input.alttext !== undefined ? { alttext: input.alttext } : {}),
        ...(input.isactive !== undefined ? { isactive: input.isactive } : {}),
        modifiedby: userid ?? null,
        modifieddate: BigInt(Date.now()),
      },
    });

    return serializeImage(image);
  }

  async deleteImage(picklistId: number) {
    await this.getByPicklistId(picklistId);

    const existing = await prisma.categoryImage.findUnique({
      where: { picklistid: picklistId },
    });

    if (!existing) {
      throw new NotFoundError('No image has been configured for this picklist');
    }

    await prisma.categoryImage.delete({
      where: { picklistid: picklistId },
    });

    return serializeImage(existing);
  }
}
