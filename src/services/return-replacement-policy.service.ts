import { prisma } from '../models/prisma.js';
import {
  CreateReturnReplacementPolicyInput,
  ReturnReplacementPolicyEligibilityQuery,
  ReturnReplacementPolicyQuery,
  UpdateReturnReplacementPolicyInput,
} from '../schemas/return-replacement-policy.schema.js';
import { createPaginationResult, getPrismaSkipTake, PaginationResult } from '../utils/pagination.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
import { ReturnPolicyReasonRuleService } from './return-policy-reason-rule.service.js';

type PolicyScope = {
  category: string;
  subcategory?: string | null;
};

const policyClient = () => (prisma as any).returnReplacementPolicy;
const policyClientFor = (database: any = prisma) => (database as any).returnReplacementPolicy;

function normalizeScopeValue(value?: string | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredScopeValue(value: string) {
  const normalized = normalizeScopeValue(value);
  if (!normalized) {
    throw new ValidationError('Invalid category', 'category is required');
  }
  return normalized;
}

function buildScopeKey(scope: PolicyScope) {
  return [
    normalizeRequiredScopeValue(scope.category).toLowerCase(),
    (normalizeScopeValue(scope.subcategory) || '*').toLowerCase(),
  ].join('|');
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function sanitizePolicyInput<T extends CreateReturnReplacementPolicyInput | UpdateReturnReplacementPolicyInput>(
  data: T
) {
  const sanitized: Record<string, any> = { ...data };

  if (typeof sanitized.category === 'string') {
    sanitized.category = normalizeRequiredScopeValue(sanitized.category);
  }
  if ('subcategory' in sanitized) {
    sanitized.subcategory = normalizeScopeValue(sanitized.subcategory);
  }
  return sanitized;
}

export class ReturnReplacementPolicyService {
  private policyReasonRuleService = new ReturnPolicyReasonRuleService();

  async findMany(
    query: ReturnReplacementPolicyQuery,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where: Record<string, any> = {};

    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }
    if (query.subcategory) {
      where.subcategory = { equals: query.subcategory, mode: 'insensitive' };
    }
    if (query.isactive !== undefined) {
      where.isactive = query.isactive === 'true';
    }

    const [policies, total] = await Promise.all([
      policyClient().findMany({
        where,
        skip,
        take,
        orderBy: [{ category: 'asc' }, { subcategory: 'asc' }],
      }),
      policyClient().count({ where }),
    ]);

    return createPaginationResult(policies, total, page, limit);
  }

  async findById(id: string) {
    const policy = await this.findPolicyWithReasonMappings(parseInt(id, 10));

    if (!policy) {
      throw new NotFoundError(`Return/replacement policy with ID ${id} not found`);
    }

    return policy;
  }

  async create(data: CreateReturnReplacementPolicyInput) {
    const payload = sanitizePolicyInput(data);
    payload.scopekey = buildScopeKey(payload as PolicyScope);
    payload.createddate = payload.createddate || nowSeconds();
    payload.modifieddate = payload.modifieddate || payload.createddate;

    try {
      return await prisma.$transaction(async (tx: any) => {
        const policy = await policyClientFor(tx).create({ data: payload });
        await this.policyReasonRuleService.ensureDefaultMappingsForPolicy(policy.id, {
          database: tx,
          createdBy: policy.createdby || null,
          modifiedBy: policy.modifiedby || policy.createdby || null,
          timestamp: policy.createddate || payload.createddate,
        });

        return this.findPolicyWithReasonMappings(policy.id, tx);
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ValidationError(
          'Policy already exists',
          'A policy already exists for this category/subcategory scope'
        );
      }
      logger.error({ error, payload }, 'Failed to create return/replacement policy');
      throw error;
    }
  }

  async upsertByScope(data: CreateReturnReplacementPolicyInput) {
    const payload = sanitizePolicyInput(data);
    payload.scopekey = buildScopeKey(payload as PolicyScope);
    payload.modifieddate = nowSeconds();

    return prisma.$transaction(async (tx: any) => {
      const policy = await policyClientFor(tx).upsert({
        where: { scopekey: payload.scopekey },
        create: {
          ...payload,
          createddate: payload.createddate || payload.modifieddate,
        },
        update: payload,
      });

      await this.policyReasonRuleService.ensureDefaultMappingsForPolicy(policy.id, {
        database: tx,
        createdBy: policy.createdby || null,
        modifiedBy: policy.modifiedby || policy.createdby || null,
        timestamp: payload.modifieddate,
      });

      return this.findPolicyWithReasonMappings(policy.id, tx);
    });
  }

  async update(id: string, data: UpdateReturnReplacementPolicyInput) {
    const existingPolicy = await this.findById(id);
    const payload = sanitizePolicyInput(data);

    if (payload.category || payload.subcategory !== undefined) {
      payload.scopekey = buildScopeKey({
        category: payload.category || existingPolicy.category,
        subcategory: payload.subcategory !== undefined ? payload.subcategory : existingPolicy.subcategory,
      });
    }

    payload.modifieddate = nowSeconds();

    try {
      return await policyClient().update({
        where: { id: parseInt(id, 10) },
        data: payload,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ValidationError(
          'Policy already exists',
          'Another policy already exists for this category/subcategory scope'
        );
      }
      logger.error({ error, id, payload }, 'Failed to update return/replacement policy');
      throw error;
    }
  }

  async delete(id: string) {
    await this.findById(id);
    return policyClient().delete({
      where: { id: parseInt(id, 10) },
    });
  }

  async resolveEligibility(query: ReturnReplacementPolicyEligibilityQuery) {
    const scope = await this.resolveScope(query);
    const policy = await this.findApplicablePolicy(scope);
    const requestType = query.requesttype;
    const allowed = policy
      ? requestType === 'return'
        ? policy.returnallowed
        : policy.replacementallowed
      : false;

    const windowDays = policy
      ? requestType === 'return'
        ? policy.returnwindowdays
        : policy.replacementwindowdays
      : null;

    return {
      requesttype: requestType,
      eligible: Boolean(allowed),
      category: scope.category,
      subcategory: scope.subcategory,
      windowdays: allowed ? windowDays : null,
      allowedrefundmethods: requestType === 'return' && allowed ? policy?.allowedrefundmethods || [] : [],
      policy,
      reason: policy
        ? allowed
          ? 'Category policy allows this request type'
          : `Category policy does not allow ${requestType}`
        : 'No active policy found for this category scope',
    };
  }

  private async resolveScope(query: ReturnReplacementPolicyEligibilityQuery): Promise<PolicyScope> {
    if (query.orderlineid) {
      const orderline = await (prisma as any).orderline.findUnique({
        where: { id: query.orderlineid },
        include: { product: true },
      });

      if (!orderline) {
        throw new NotFoundError(`Orderline with ID ${query.orderlineid} not found`);
      }

      return this.scopeFromProductOrOrderline(orderline.product, orderline);
    }

    if (query.productid) {
      const product = await (prisma as any).product.findUnique({
        where: { id: BigInt(query.productid) },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${query.productid} not found`);
      }

      return this.scopeFromProductOrOrderline(product);
    }

    if (!query.category) {
      throw new ValidationError('Category is required', 'Provide category, productid, or orderlineid');
    }

    return {
      category: normalizeRequiredScopeValue(query.category),
      subcategory: normalizeScopeValue(query.subcategory),
    };
  }

  private scopeFromProductOrOrderline(product?: any, orderline?: any): PolicyScope {
    const category = normalizeScopeValue(product?.category) || normalizeScopeValue(orderline?.productcategory);

    if (!category) {
      throw new ValidationError(
        'Category unavailable',
        'The selected product/orderline does not have a category to evaluate'
      );
    }

    return {
      category,
      subcategory: normalizeScopeValue(product?.subcategory),
    };
  }

  private async findApplicablePolicy(scope: PolicyScope) {
    const policies = await policyClient().findMany({
      where: {
        category: { equals: scope.category, mode: 'insensitive' },
        isactive: true,
      },
    });

    const normalizedSubcategory = normalizeScopeValue(scope.subcategory)?.toLowerCase() || null;

    return policies
      .map((policy: any) => {
        const policySubcategory = normalizeScopeValue(policy.subcategory)?.toLowerCase() || null;

        if (policySubcategory && policySubcategory !== normalizedSubcategory) {
          return null;
        }

        const score = policySubcategory ? 1 : 0;
        return { policy, score };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)[0]?.policy || null;
  }

  private async findPolicyWithReasonMappings(id: number, database: any = prisma) {
    const policy = await policyClientFor(database).findUnique({
      where: { id },
    });

    if (!policy) {
      return null;
    }

    const policyReasonRules = await this.policyReasonRuleService.findMappingsForPolicy(id, database);
    return {
      ...policy,
      policyReasonRules,
    };
  }
}
