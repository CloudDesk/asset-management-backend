import { prisma } from '../models/prisma.js';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
import { UpdatePolicyReasonRuleInput, ResetPolicyReasonRuleInput } from '../schemas/return-replacement-policy.schema.js';

export const CUSTOMER_RETURN_REASON_CODES = [
  'wrong_product',
  'damaged_product',
  'missing_product',
  'defective_product',
  'leakage_broken_bottle',
  'changed_mind',
] as const;

const policyClient = (database: any = prisma) => (database as any).returnReplacementPolicy;
const reasonRuleClient = (database: any = prisma) => (database as any).returnReasonRule;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function nullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function hasRequiredEvidence(config: any, evidenceType: string) {
  return asArray<any>(config.evidence).some(
    (rule) => normalizeCode(String(rule?.type || '')) === evidenceType && Boolean(rule?.required) && Number(rule?.minimum || 0) > 0
  );
}

function normalizeEvidenceRules(value: unknown) {
  return asArray<any>(value)
    .map((rule) => ({
      type: normalizeCode(String(rule?.type || '')),
      required: Boolean(rule?.required),
      minimum: Number.isFinite(Number(rule?.minimum)) ? Number(rule.minimum) : (rule?.required ? 1 : 0),
    }))
    .filter((rule) => rule.type);
}

function normalizePolicyReasonConfiguration(configuration: any, reason: any) {
  const pickup = configuration.pickup || {};
  const normalized = {
    ...configuration,
    schemaVersion: configuration.schemaVersion || reason?.schemaversion || 1,
    reasonCode: reason?.reasoncode || configuration.reasonCode,
    reasonName: reason?.reasonname || configuration.reasonName,
    aliases: asArray<string>(configuration.aliases),
    raiseWithinHours: configuration.raiseWithinHours ?? null,
    evidence: normalizeEvidenceRules(configuration.evidence),
    allowedResolutions: asArray<string>(configuration.allowedResolutions),
    openedPackageAllowed: configuration.openedPackageAllowed !== false,
    approvalMode: configuration.approvalMode === 'pickup_first' ? 'pickup_first' : 'evidence_first',
    resolutionTiming: configuration.resolutionTiming ?? null,
    pickup: {
      required: pickup.required !== false,
      triggerMode: 'manual_admin',
      chargeBearer: 'nivaana',
      deductChargeFromRefund: false,
    },
    stockUnavailableResolution: configuration.stockUnavailableResolution ?? null,
    notifyCustomerOnStockFallback: configuration.notifyCustomerOnStockFallback !== false,
  };

  normalized.legacyFields = {
    ...(configuration.legacyFields || {}),
    photorequired: hasRequiredEvidence(normalized, 'product_photo'),
    videorequired: hasRequiredEvidence(normalized, 'defect_video'),
    packagephotorequired: hasRequiredEvidence(normalized, 'package_photo'),
    packagephotooptional: asArray<any>(normalized.evidence).some((rule) => rule.type === 'package_photo' && !rule.required),
    unboxingvideorequired: hasRequiredEvidence(normalized, 'unboxing_video'),
    unboxingvideooptional: asArray<any>(normalized.evidence).some((rule) => rule.type === 'unboxing_video' && !rule.required),
    pickuprequired: normalized.pickup.required,
    evidencefirstapproval: normalized.approvalMode === 'evidence_first',
    autocreatepickup: false,
    reverseshippingchargebearer: 'nivaana',
  };

  return normalized;
}

function mergeConfiguration(existing: any, patch: any, reason: any) {
  return normalizePolicyReasonConfiguration(
    {
      ...(existing || {}),
      ...patch,
      pickup: {
        ...((existing || {}).pickup || {}),
        ...(patch.pickup || {}),
      },
    },
    reason
  );
}

function assertValidPolicyReasonConfiguration(configuration: any) {
  if (!Array.isArray(configuration.allowedResolutions) || configuration.allowedResolutions.length === 0) {
    throw new ValidationError(
      'Allowed outcomes are required',
      'Select at least one outcome for this policy reason'
    );
  }

  const evidence = normalizeEvidenceRules(configuration.evidence);
  const hasRequiredPhoto = evidence.some((rule) =>
    ['product_photo', 'package_photo'].includes(rule.type) && rule.required && rule.minimum > 0
  );

  if (!hasRequiredPhoto) {
    throw new ValidationError(
      'Photo evidence is required',
      'Every customer-facing policy reason must require at least one product or package photo'
    );
  }

  if (configuration.pickup?.chargeBearer !== 'nivaana' || configuration.pickup?.deductChargeFromRefund !== false) {
    throw new ValidationError(
      'Invalid reverse-shipping configuration',
      'Nivaana must bear reverse-shipping charges and nothing can be deducted from customer refund'
    );
  }
}

export function buildPolicyReasonConfiguration(reasonRule: any) {
  const schemaVersion = reasonRule.schemaversion || reasonRule.schemaVersion || 1;

  return normalizePolicyReasonConfiguration({
    schemaVersion,
    reasonCode: reasonRule.reasoncode,
    reasonName: reasonRule.reasonname,
    aliases: asArray<string>(reasonRule.aliases),
    raiseWithinHours: nullable(reasonRule.raisewithinhours),
    evidence: asArray(reasonRule.evidencerules),
    allowedResolutions: asArray<string>(reasonRule.allowedresolutions),
    openedPackageAllowed: reasonRule.openedpackageallowed !== false,
    approvalMode: reasonRule.evidencefirstapproval ? 'evidence_first' : 'pickup_first',
    resolutionTiming: nullable(reasonRule.resolutiontiming),
    pickup: {
      required: reasonRule.pickuprequired !== false,
      triggerMode: reasonRule.pickuptriggermode || 'manual_admin',
      chargeBearer: 'nivaana',
      deductChargeFromRefund: false,
    },
    stockUnavailableResolution: nullable(reasonRule.stockunavailableresolution),
    notifyCustomerOnStockFallback: reasonRule.notifycustomeronstockfallback !== false,
    legacyFields: {
      photorequired: reasonRule.photorequired !== false,
      videorequired: Boolean(reasonRule.videorequired),
      packagephotorequired: Boolean(reasonRule.packagephotorequired),
      packagephotooptional: Boolean(reasonRule.packagephotooptional),
      unboxingvideorequired: Boolean(reasonRule.unboxingvideorequired),
      unboxingvideooptional: Boolean(reasonRule.unboxingvideooptional),
      pickuprequired: reasonRule.pickuprequired !== false,
      evidencefirstapproval: Boolean(reasonRule.evidencefirstapproval),
      autocreatepickup: false,
      reverseshippingchargebearer: 'nivaana',
    },
  }, reasonRule);
}

export class ReturnPolicyReasonRuleService {
  async listPolicyReasonRules(policyId: number, database: any = prisma) {
    const policy = await this.assertPolicyExists(policyId, database);
    const mappings = await this.findMappingsForPolicy(policyId, database);

    if (mappings.length === 0) {
      return this.ensureDefaultMappingsForPolicy(policyId, {
        database,
        createdBy: policy.createdby || null,
        modifiedBy: policy.modifiedby || policy.createdby || null,
        timestamp: nowSeconds(),
      });
    }

    return mappings;
  }

  async getPolicyReasonRule(policyId: number, reasonCode: string, database: any = prisma) {
    await this.listPolicyReasonRules(policyId, database);
    const mapping = await this.findMappingForPolicyReasonCode(policyId, reasonCode, database);

    if (!mapping) {
      throw new NotFoundError(`Policy reason ${reasonCode} not found for policy ${policyId}`);
    }

    return mapping;
  }

  async updatePolicyReasonRule(
    policyId: number,
    reasonCode: string,
    data: UpdatePolicyReasonRuleInput,
    database: any = prisma
  ) {
    const existing = await this.getPolicyReasonRule(policyId, reasonCode, database);

    if (Number(existing.configurationVersion) !== Number(data.configurationVersion)) {
      throw new DatabaseError(
        'Policy reason configuration changed',
        'Refresh the policy reason and retry with the latest configuration version.',
        409
      );
    }

    const nextConfiguration = mergeConfiguration(existing.configuration, data.configuration, existing.reason);
    assertValidPolicyReasonConfiguration(nextConfiguration);

    const timestamp = nowSeconds();
    await database.$executeRaw`
      UPDATE "return_policy_reason_rules"
      SET
        "configuration" = CAST(${JSON.stringify(nextConfiguration)} AS JSONB),
        "configuration_version" = "configuration_version" + 1,
        "is_active" = ${data.isActive ?? existing.isActive},
        "modified_by" = ${data.modifiedBy || null},
        "modified_date" = ${timestamp}
      WHERE "id" = ${existing.id}
    `;

    logger.info(
      {
        policyId,
        reasonCode: existing.reason?.reasoncode,
        mappingId: existing.id,
        previousVersion: existing.configurationVersion,
      },
      'Policy reason configuration updated'
    );

    return this.findMappingById(existing.id, database);
  }

  async resetPolicyReasonRule(
    policyId: number,
    reasonCode: string,
    data: ResetPolicyReasonRuleInput = {},
    database: any = prisma
  ) {
    const existing = await this.getPolicyReasonRule(policyId, reasonCode, database);

    if (
      data.configurationVersion !== undefined
      && Number(existing.configurationVersion) !== Number(data.configurationVersion)
    ) {
      throw new DatabaseError(
        'Policy reason configuration changed',
        'Refresh the policy reason and retry with the latest configuration version.',
        409
      );
    }

    const reasonMaster = await reasonRuleClient(database).findFirst({
      where: {
        reasoncode: existing.reason?.reasoncode,
        status: 'active',
        OR: [{ source: 'customer' }, { source: 'both' }],
      },
    });

    if (!reasonMaster) {
      throw new NotFoundError(`Active reason master ${existing.reason?.reasoncode || reasonCode} not found`);
    }

    const nextConfiguration = buildPolicyReasonConfiguration(reasonMaster);
    assertValidPolicyReasonConfiguration(nextConfiguration);

    const timestamp = nowSeconds();
    await database.$executeRaw`
      UPDATE "return_policy_reason_rules"
      SET
        "configuration" = CAST(${JSON.stringify(nextConfiguration)} AS JSONB),
        "schema_version" = ${reasonMaster.schemaversion || 1},
        "configuration_version" = "configuration_version" + 1,
        "is_active" = true,
        "modified_by" = ${data.modifiedBy || null},
        "modified_date" = ${timestamp}
      WHERE "id" = ${existing.id}
    `;

    logger.info(
      {
        policyId,
        reasonCode: reasonMaster.reasoncode,
        mappingId: existing.id,
        previousVersion: existing.configurationVersion,
      },
      'Policy reason configuration reset to master default'
    );

    return this.findMappingById(existing.id, database);
  }

  async ensureDefaultMappingsForPolicy(
    policyId: number,
    options: {
      database?: any;
      createdBy?: number | null;
      modifiedBy?: number | null;
      timestamp?: number;
    } = {}
  ) {
    const database = options.database || prisma;
    const timestamp = options.timestamp || nowSeconds();
    const reasonMasters = await this.getActiveCustomerReasonMasters(database);

    const rows = reasonMasters.map((reasonRule: any) => ({
      policyId,
      reasonId: reasonRule.id,
      configuration: buildPolicyReasonConfiguration(reasonRule),
      schemaVersion: reasonRule.schemaversion || 1,
      configurationVersion: 1,
      isActive: true,
      createdBy: options.createdBy || null,
      modifiedBy: options.modifiedBy || options.createdBy || null,
      createdDate: timestamp,
      modifiedDate: timestamp,
    }));

    for (const row of rows) {
      await database.$executeRaw`
        INSERT INTO "return_policy_reason_rules" (
          "policy_id",
          "reason_id",
          "configuration",
          "schema_version",
          "configuration_version",
          "is_active",
          "created_by",
          "modified_by",
          "created_date",
          "modified_date"
        ) VALUES (
          ${row.policyId},
          ${row.reasonId},
          CAST(${JSON.stringify(row.configuration)} AS JSONB),
          ${row.schemaVersion},
          ${row.configurationVersion},
          ${row.isActive},
          ${row.createdBy},
          ${row.modifiedBy},
          ${row.createdDate},
          ${row.modifiedDate}
        )
        ON CONFLICT ("policy_id", "reason_id") DO NOTHING
      `;
    }

    const mappings = await this.findMappingsForPolicy(policyId, database);
    this.assertPolicyHasSixCustomerMappings(policyId, mappings);

    return mappings;
  }

  async backfillAllPolicyMappings(options: { database?: any; timestamp?: number } = {}) {
    const database = options.database || prisma;
    const timestamp = options.timestamp || nowSeconds();
    const policies = await policyClient(database).findMany({
      select: {
        id: true,
        createdby: true,
        modifiedby: true,
      },
      orderBy: { id: 'asc' },
    });

    let createdOrExistingMappingCount = 0;

    for (const policy of policies) {
      const mappings = await this.ensureDefaultMappingsForPolicy(policy.id, {
        database,
        createdBy: policy.createdby || null,
        modifiedBy: policy.modifiedby || policy.createdby || null,
        timestamp,
      });
      createdOrExistingMappingCount += mappings.length;
    }

    logger.info(
      {
        policyCount: policies.length,
        mappingCount: createdOrExistingMappingCount,
      },
      'Return policy reason mappings backfilled'
    );

    return {
      policyCount: policies.length,
      mappingCount: createdOrExistingMappingCount,
    };
  }

  async findMappingsForPolicy(policyId: number, database: any = prisma) {
    return database.$queryRaw`
      SELECT
        mapping."id",
        mapping."policy_id" AS "policyId",
        mapping."reason_id" AS "reasonId",
        mapping."configuration",
        mapping."schema_version" AS "schemaVersion",
        mapping."configuration_version" AS "configurationVersion",
        mapping."is_active" AS "isActive",
        mapping."created_by" AS "createdBy",
        mapping."modified_by" AS "modifiedBy",
        mapping."created_date" AS "createdDate",
        mapping."modified_date" AS "modifiedDate",
        jsonb_build_object(
          'id', reason."id",
          'reasoncode', reason."reasoncode",
          'reasonname', reason."reasonname",
          'source', reason."source",
          'status', reason."status",
          'schemaversion', reason."schema_version"
        ) AS "reason"
      FROM "return_policy_reason_rules" AS mapping
      INNER JOIN "return_reason_rules" AS reason
        ON reason."id" = mapping."reason_id"
      WHERE mapping."policy_id" = ${policyId}
      ORDER BY mapping."id" ASC
    `;
  }

  async findMappingById(mappingId: number, database: any = prisma) {
    const rows = await database.$queryRaw`
      SELECT
        mapping."id",
        mapping."policy_id" AS "policyId",
        mapping."reason_id" AS "reasonId",
        mapping."configuration",
        mapping."schema_version" AS "schemaVersion",
        mapping."configuration_version" AS "configurationVersion",
        mapping."is_active" AS "isActive",
        mapping."created_by" AS "createdBy",
        mapping."modified_by" AS "modifiedBy",
        mapping."created_date" AS "createdDate",
        mapping."modified_date" AS "modifiedDate",
        jsonb_build_object(
          'id', reason."id",
          'reasoncode', reason."reasoncode",
          'reasonname', reason."reasonname",
          'source', reason."source",
          'status', reason."status",
          'schemaversion', reason."schema_version"
        ) AS "reason"
      FROM "return_policy_reason_rules" AS mapping
      INNER JOIN "return_reason_rules" AS reason
        ON reason."id" = mapping."reason_id"
      WHERE mapping."id" = ${mappingId}
      LIMIT 1
    `;

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async findMappingForPolicyReasonCode(policyId: number, reasonCode: string, database: any = prisma) {
    const normalizedReasonCode = normalizeCode(reasonCode);
    const rows = await database.$queryRaw`
      SELECT
        mapping."id",
        mapping."policy_id" AS "policyId",
        mapping."reason_id" AS "reasonId",
        mapping."configuration",
        mapping."schema_version" AS "schemaVersion",
        mapping."configuration_version" AS "configurationVersion",
        mapping."is_active" AS "isActive",
        mapping."created_by" AS "createdBy",
        mapping."modified_by" AS "modifiedBy",
        mapping."created_date" AS "createdDate",
        mapping."modified_date" AS "modifiedDate",
        jsonb_build_object(
          'id', reason."id",
          'reasoncode', reason."reasoncode",
          'reasonname', reason."reasonname",
          'source', reason."source",
          'status', reason."status",
          'schemaversion', reason."schema_version"
        ) AS "reason"
      FROM "return_policy_reason_rules" AS mapping
      INNER JOIN "return_reason_rules" AS reason
        ON reason."id" = mapping."reason_id"
      WHERE mapping."policy_id" = ${policyId}
        AND LOWER(REGEXP_REPLACE(reason."reasoncode", '[^a-zA-Z0-9]+', '_', 'g')) = ${normalizedReasonCode}
      LIMIT 1
    `;

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  private async getActiveCustomerReasonMasters(database: any) {
    const reasonMasters = await reasonRuleClient(database).findMany({
      where: {
        status: 'active',
        reasoncode: { in: [...CUSTOMER_RETURN_REASON_CODES] },
        OR: [{ source: 'customer' }, { source: 'both' }],
      },
      orderBy: { reasonname: 'asc' },
    });

    const foundCodes = new Set(reasonMasters.map((reason: any) => reason.reasoncode));
    const missingCodes = CUSTOMER_RETURN_REASON_CODES.filter((code) => !foundCodes.has(code));

    if (missingCodes.length > 0 || reasonMasters.length !== CUSTOMER_RETURN_REASON_CODES.length) {
      throw new ValidationError(
        'Return reason masters are incomplete',
        `Expected six active customer reason masters. Missing or inactive: ${missingCodes.join(', ') || 'duplicate/invalid reason master rows'}`
      );
    }

    return reasonMasters;
  }

  private assertPolicyHasSixCustomerMappings(policyId: number, mappings: any[]) {
    const mappedCodes = new Set(
      mappings
        .map((mapping: any) => mapping.reason?.reasoncode)
        .filter((reasonCode: unknown): reasonCode is string => typeof reasonCode === 'string')
    );
    const missingCodes = CUSTOMER_RETURN_REASON_CODES.filter((code) => !mappedCodes.has(code));

    if (missingCodes.length > 0 || mappedCodes.size !== CUSTOMER_RETURN_REASON_CODES.length) {
      throw new ValidationError(
        'Return policy reason mapping incomplete',
        `Policy ${policyId} must have exactly six customer reason mappings. Missing: ${missingCodes.join(', ') || 'unknown'}`
      );
    }
  }

  private async assertPolicyExists(policyId: number, database: any) {
    const policy = await policyClient(database).findUnique({
      where: { id: policyId },
      select: { id: true, createdby: true, modifiedby: true },
    });

    if (!policy) {
      throw new NotFoundError(`Return/replacement policy with ID ${policyId} not found`);
    }

    return policy;
  }
}
