import { prisma } from '../models/prisma.js';
import {
  CreateReturnReasonRuleInput,
  ReturnReasonRuleQuery,
  UpdateReturnReasonRuleInput,
} from '../schemas/return-source.schema.js';
import { createPaginationResult, getPrismaSkipTake, PaginationResult } from '../utils/pagination.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';

const reasonRuleClient = () => (prisma as any).returnReasonRule;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function sanitizeRuleInput<T extends CreateReturnReasonRuleInput | UpdateReturnReasonRuleInput>(data: T) {
  const payload: Record<string, any> = { ...data };

  if (typeof payload.reasoncode === 'string') {
    payload.reasoncode = normalizeCode(payload.reasoncode);
  }
  if (Array.isArray(payload.aliases)) {
    payload.aliases = payload.aliases
      .map((alias: string) => alias.trim())
      .filter(Boolean);
  }
  if (Array.isArray(payload.allowedresolutions)) {
    payload.allowedresolutions = Array.from(new Set(payload.allowedresolutions));
  }

  if (Array.isArray(payload.evidencerules)) {
    payload.evidencerules = payload.evidencerules.map((rule: any) => ({
      type: normalizeCode(String(rule.type || '')),
      required: Boolean(rule.required),
      minimum: Number.isFinite(Number(rule.minimum)) ? Number(rule.minimum) : (rule.required ? 1 : 0),
    })).filter((rule: any) => rule.type);
  }

  payload.schemaversion = payload.schemaversion || 1;
  payload.autocreatepickup = false;
  payload.pickuptriggermode = 'manual_admin';
  if (payload.source === 'customer' || payload.source === 'both' || payload.source === undefined) {
    payload.reverseshippingchargebearer = 'nivaana';
  }

  return payload;
}

export const DEFAULT_RETURN_REASON_RULES: Array<Record<string, any>> = [
  {
    reasoncode: 'wrong_product',
    reasonname: 'Wrong Product',
    source: 'customer',
    aliases: ['Wrong Product', 'Wrong Item Received'],
    allowedresolutions: ['replacement', 'refund'],
    evidencerules: [{ type: 'product_photo', required: true, minimum: 1 }],
    photorequired: true,
    pickuprequired: true,
    evidencefirstapproval: false,
    autocreatepickup: false,
    reverseshippingchargebearer: 'nivaana',
    resolutiontiming: 'after_warehouse_verification',
    stockunavailableresolution: 'refund',
    pickuptriggermode: 'manual_admin',
    notifycustomeronstockfallback: true,
    notes: 'Product photo is required. Product should be kept intact for pickup and warehouse verification.',
    status: 'active',
  },
  {
    reasoncode: 'damaged_product',
    reasonname: 'Damaged Product',
    source: 'customer',
    aliases: ['Damaged Product'],
    allowedresolutions: ['replacement'],
    raisewithinhours: 48,
    evidencerules: [
      { type: 'product_photo', required: true, minimum: 1 },
      { type: 'package_photo', required: false, minimum: 0 },
      { type: 'unboxing_video', required: false, minimum: 0 },
    ],
    photorequired: true,
    packagephotooptional: true,
    unboxingvideooptional: true,
    pickuprequired: true,
    evidencefirstapproval: true,
    autocreatepickup: false,
    reverseshippingchargebearer: 'nivaana',
    resolutiontiming: 'after_warehouse_verification',
    stockunavailableresolution: 'refund',
    pickuptriggermode: 'manual_admin',
    notifycustomeronstockfallback: true,
    notes: 'Must be raised within 48 hours from delivery. Replacement falls back to refund when stock is unavailable.',
    status: 'active',
  },
  {
    reasoncode: 'missing_product',
    reasonname: 'Missing Product',
    source: 'customer',
    aliases: ['Missing Product'],
    allowedresolutions: ['ship_missing_item', 'partial_refund', 'complete_return'],
    evidencerules: [
      { type: 'product_photo', required: true, minimum: 1 },
      { type: 'package_photo', required: true, minimum: 1 },
    ],
    photorequired: true,
    packagephotorequired: true,
    pickuprequired: false,
    evidencefirstapproval: true,
    autocreatepickup: false,
    reverseshippingchargebearer: 'nivaana',
    resolutiontiming: 'after_team_verification',
    pickuptriggermode: 'manual_admin',
    notes: 'Pickup is required only if the selected resolution is complete_return.',
    status: 'active',
  },
  {
    reasoncode: 'defective_product',
    reasonname: 'Defective Product',
    source: 'customer',
    aliases: ['Defective Product'],
    allowedresolutions: ['replacement', 'refund'],
    evidencerules: [
      { type: 'product_photo', required: true, minimum: 1 },
      { type: 'defect_video', required: true, minimum: 1 },
    ],
    photorequired: true,
    videorequired: true,
    pickuprequired: true,
    evidencefirstapproval: true,
    autocreatepickup: false,
    reverseshippingchargebearer: 'nivaana',
    resolutiontiming: 'after_warehouse_verification',
    stockunavailableresolution: 'refund',
    pickuptriggermode: 'manual_admin',
    notifycustomeronstockfallback: true,
    notes: 'Photo and video evidence are mandatory.',
    status: 'active',
  },
  {
    reasoncode: 'leakage_broken_bottle',
    reasonname: 'Leakage / Broken Bottle',
    source: 'customer',
    aliases: ['Leakage / Broken Bottle', 'Leakage', 'Broken Bottle'],
    allowedresolutions: ['replacement', 'refund'],
    evidencerules: [
      { type: 'product_photo', required: true, minimum: 1 },
      { type: 'defect_video', required: true, minimum: 1 },
    ],
    photorequired: true,
    videorequired: true,
    pickuprequired: true,
    evidencefirstapproval: true,
    autocreatepickup: false,
    reverseshippingchargebearer: 'nivaana',
    resolutiontiming: 'after_warehouse_verification',
    stockunavailableresolution: 'refund',
    pickuptriggermode: 'manual_admin',
    notifycustomeronstockfallback: true,
    notes: 'Photo and video evidence are mandatory.',
    status: 'active',
  },
  {
    reasoncode: 'changed_mind',
    reasonname: 'Changed Mind',
    source: 'customer',
    aliases: ['Changed Mind', 'Wrongly Ordered'],
    allowedresolutions: ['complete_return', 'refund'],
    evidencerules: [
      { type: 'product_photo', required: true, minimum: 1 },
      { type: 'package_photo', required: true, minimum: 1 },
    ],
    photorequired: true,
    packagephotorequired: true,
    openedpackageallowed: false,
    pickuprequired: true,
    evidencefirstapproval: true,
    autocreatepickup: false,
    reverseshippingchargebearer: 'nivaana',
    resolutiontiming: 'after_warehouse_verification',
    pickuptriggermode: 'manual_admin',
    notes: 'Package must be unopened. Evidence approval is required before pickup. Nivaana bears reverse shipping.',
    status: 'active',
  },
  {
    reasoncode: 'customer_unreachable',
    reasonname: 'Customer Unreachable',
    source: 'delivery_partner',
    aliases: ['Customer unreachable', 'Customer not reachable'],
    allowedresolutions: [],
    photorequired: false,
    pickuprequired: false,
    evidencefirstapproval: false,
    autocreatepickup: false,
    evidencerules: [],
    pickuptriggermode: 'manual_admin',
    status: 'active',
  },
  {
    reasoncode: 'wrong_address',
    reasonname: 'Wrong Address',
    source: 'delivery_partner',
    aliases: ['Wrong address', 'Incorrect address', 'Incomplete delivery address'],
    allowedresolutions: [],
    photorequired: false,
    pickuprequired: false,
    evidencefirstapproval: false,
    autocreatepickup: false,
    evidencerules: [],
    pickuptriggermode: 'manual_admin',
    status: 'active',
  },
  {
    reasoncode: 'customer_refused_delivery',
    reasonname: 'Customer Refused Delivery',
    source: 'delivery_partner',
    aliases: ['Customer refused', 'Customer refused delivery'],
    allowedresolutions: [],
    photorequired: false,
    pickuprequired: false,
    evidencefirstapproval: false,
    autocreatepickup: false,
    evidencerules: [],
    pickuptriggermode: 'manual_admin',
    status: 'active',
  },
  {
    reasoncode: 'delivery_attempt_failed',
    reasonname: 'Delivery Attempt Failed',
    source: 'delivery_partner',
    aliases: ['Delivery attempt failed', 'Delivery attempts failed'],
    allowedresolutions: [],
    photorequired: false,
    pickuprequired: false,
    evidencefirstapproval: false,
    autocreatepickup: false,
    evidencerules: [],
    pickuptriggermode: 'manual_admin',
    status: 'active',
  },
];

export class ReturnReasonRuleService {
  async findMany(query: ReturnReasonRuleQuery, page: number, limit: number): Promise<PaginationResult<any>> {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where: Record<string, any> = {};

    if (query.source) {
      where.source = query.source;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.q) {
      where.OR = [
        { reasoncode: { contains: query.q, mode: 'insensitive' } },
        { reasonname: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [rules, total] = await Promise.all([
      reasonRuleClient().findMany({
        where,
        skip,
        take,
        orderBy: [{ source: 'asc' }, { reasonname: 'asc' }],
      }),
      reasonRuleClient().count({ where }),
    ]);

    return createPaginationResult(rules, total, page, limit);
  }

  async findById(id: string) {
    const rule = await reasonRuleClient().findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!rule) {
      throw new NotFoundError(`Return reason rule with ID ${id} not found`);
    }

    return rule;
  }

  async findActiveByCodeOrAlias(value: string, source: 'customer' | 'delivery_partner' | 'admin' = 'customer') {
    const normalized = normalizeCode(value);
    const rules = await reasonRuleClient().findMany({
      where: {
        status: 'active',
        OR: [{ source }, { source: 'both' }],
      },
    });

    const match = rules.find((rule: any) => {
      if (normalizeCode(rule.reasoncode) === normalized || normalizeCode(rule.reasonname) === normalized) {
        return true;
      }

      return Array.isArray(rule.aliases) && rule.aliases.some((alias: string) => normalizeCode(alias) === normalized);
    });

    if (!match) {
      throw new ValidationError('Invalid return reason', `No active reason rule found for ${value}`);
    }

    return match;
  }

  async create(data: CreateReturnReasonRuleInput) {
    const payload = sanitizeRuleInput(data);
    payload.createddate = nowSeconds();
    payload.modifieddate = payload.createddate;

    try {
      return await reasonRuleClient().create({ data: payload });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ValidationError('Reason rule already exists', 'A rule already exists for this reason code');
      }
      logger.error({ error, payload }, 'Failed to create return reason rule');
      throw error;
    }
  }

  async update(id: string, data: UpdateReturnReasonRuleInput) {
    await this.findById(id);
    const payload = sanitizeRuleInput(data);
    payload.modifieddate = nowSeconds();

    try {
      return await reasonRuleClient().update({
        where: { id: parseInt(id, 10) },
        data: payload,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ValidationError('Reason rule already exists', 'Another rule already exists for this reason code');
      }
      logger.error({ error, id, payload }, 'Failed to update return reason rule');
      throw error;
    }
  }

  async upsertDefaults() {
    const timestamp = nowSeconds();
    const results = [];

    for (const rule of DEFAULT_RETURN_REASON_RULES) {
      const payload = sanitizeRuleInput(rule);
      payload.modifieddate = timestamp;

      const saved = await reasonRuleClient().upsert({
        where: { reasoncode: payload.reasoncode },
        create: {
          ...payload,
          createddate: timestamp,
        },
        update: payload,
      });

      results.push(saved);
    }

    return results;
  }
}
