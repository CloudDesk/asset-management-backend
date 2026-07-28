import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRMATION = 'NIVAANA_GST_TAXONOMY';
const applyRequested = process.argv.includes('--apply');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.split('=')[1];

type LegacyMapping = {
  sourceValue: string;
  hsnCode?: string;
  targetValue: string;
};

const legacyMappings: LegacyMapping[] = [
  { sourceValue: 'incense_sticks', targetValue: 'incense_sticks' },
  { sourceValue: 'dhoop_sticks', targetValue: 'dhoop_sticks' },
  { sourceValue: 'havan_cups', targetValue: 'havan_cups' },
  { sourceValue: 'car_fresheners', targetValue: 'air_fresheners' },
  { sourceValue: 'room_fresheners', targetValue: 'air_fresheners' },
  { sourceValue: 'fragrance_sachets', targetValue: 'wardrobe_fragrance' },
  { sourceValue: 'essential_oils', targetValue: 'aromatherapy' },
  { sourceValue: 'fragrance_blends', targetValue: 'fragrance_oils' },
  { sourceValue: 'diffusers', hsnCode: '85167990', targetValue: 'home_diffusers' },
  { sourceValue: 'diffusers', hsnCode: '70200090', targetValue: 'reed_diffusers' },
  { sourceValue: 'bath', targetValue: 'bath_body' },
  { sourceValue: 'body', targetValue: 'skincare' },
];

const clonedMappings = [
  {
    sourceTarget: 'home_diffusers',
    targetValue: 'car_diffusers',
    description: 'Car Diffusers (Electrical) - 18% GST',
  },
  {
    sourceTarget: 'incense_sticks',
    targetValue: 'fresh_mornings',
    description: 'Fresh Mornings Incense Collection - 5% GST',
  },
  {
    sourceTarget: 'incense_sticks',
    targetValue: 'relaxation_calm',
    description: 'Relaxation & Calm Incense Collection - 5% GST',
  },
  {
    sourceTarget: 'incense_sticks',
    targetValue: 'peaceful_nights',
    description: 'Peaceful Nights Incense Collection - 5% GST',
  },
] as const;

const requiredProductMappings = [
  ['incense_sticks', '33074100', '5'],
  ['air_fresheners', '33074900', '18'],
  ['wardrobe_fragrance', '33074900', '18'],
  ['fragrance_oils', '33074900', '18'],
  ['aromatherapy', '33012990', '18'],
  ['bath_body', '34011190', '18'],
  ['fresh_mornings', '33074100', '5'],
  ['relaxation_calm', '33074100', '5'],
  ['peaceful_nights', '33074100', '5'],
] as const;

const mappingSourceValue = (mapping: {
  subcategory_value: string | null;
  subsubcategory_value: string | null;
}) => mapping.subsubcategory_value || mapping.subcategory_value;

const main = async () => {
  if (applyRequested && confirmation !== CONFIRMATION) {
    throw new Error(`Apply blocked. Pass --confirm=${CONFIRMATION} with --apply.`);
  }

  const [activeMappings, targetPicklists, inactivePicklists] = await Promise.all([
    prisma.gstHsnMapping.findMany({ where: { isactive: true }, orderBy: { id: 'asc' } }),
    prisma.picklist.findMany({
      where: { object: 'product', fieldname: 'subcategory', isactive: true },
    }),
    prisma.picklist.findMany({ where: { isactive: false }, orderBy: { id: 'asc' } }),
  ]);

  const targetByValue = new Map(targetPicklists.map((row) => [row.value, row]));
  const transformations = legacyMappings.map((rule) => {
    const alreadyMigrated = activeMappings.find(
      (mapping) =>
        mapping.subcategory_value === rule.targetValue &&
        (!rule.hsnCode || mapping.hsn_code === rule.hsnCode),
    );
    const source = activeMappings.find(
      (mapping) =>
        mappingSourceValue(mapping) === rule.sourceValue &&
        (!rule.hsnCode || mapping.hsn_code === rule.hsnCode),
    );
    const target = targetByValue.get(rule.targetValue);
    return { rule, mapping: alreadyMigrated || source, target };
  });

  const missing = transformations.filter(({ mapping, target }) => !mapping || !target);
  const uniqueTransformations = [
    ...new Map(
      transformations
        .filter(({ mapping }) => mapping)
        .map((transformation) => [transformation.mapping!.id, transformation]),
    ).values(),
  ];
  const canonicalByTargetAndHsn = new Map<string, (typeof uniqueTransformations)[number]>();
  const duplicateTransformations: typeof uniqueTransformations = [];
  for (const transformation of uniqueTransformations) {
    const key = `${transformation.target?.id}:${transformation.mapping?.hsn_code}`;
    const canonical = canonicalByTargetAndHsn.get(key);
    if (!canonical) {
      canonicalByTargetAndHsn.set(key, transformation);
      continue;
    }
    if (canonical.mapping?.gst_rate.toString() !== transformation.mapping?.gst_rate.toString()) {
      throw new Error(`Conflicting GST rates found while consolidating ${transformation.rule.targetValue}.`);
    }
    duplicateTransformations.push(transformation);
  }
  const canonicalTransformations = uniqueTransformations.filter(
    ({ mapping }) => !duplicateTransformations.some((duplicate) => duplicate.mapping?.id === mapping?.id),
  );
  const clonePlan = clonedMappings.map((clone) => ({
    ...clone,
    source: transformations.find(({ rule }) => rule.targetValue === clone.sourceTarget)?.mapping,
    target: targetByValue.get(clone.targetValue),
    existing: activeMappings.find((mapping) => mapping.subcategory_value === clone.targetValue),
  }));
  const missingClones = clonePlan.filter(({ source, target, existing }) => !existing && (!source || !target));

  console.log(JSON.stringify({
    mode: applyRequested ? 'APPLY' : 'DRY_RUN',
    legacyMappings: transformations.map(({ rule, mapping, target }) => ({
      mappingId: mapping?.id || null,
      from: rule.sourceValue,
      hsnCode: mapping?.hsn_code || rule.hsnCode || null,
      gstRate: mapping?.gst_rate?.toString() || null,
      to: rule.targetValue,
      targetPicklistId: target?.id || null,
    })),
    clones: clonePlan.map(({ sourceTarget, targetValue, source, target, existing }) => ({
      from: sourceTarget,
      to: targetValue,
      sourceMappingId: source?.id || null,
      targetPicklistId: target?.id || null,
      existingMappingId: existing?.id || null,
    })),
    duplicateMappingsToConsolidate: duplicateTransformations.map(({ mapping, rule }) => ({
      mappingId: mapping?.id,
      target: rule.targetValue,
      hsnCode: mapping?.hsn_code,
      gstRate: mapping?.gst_rate.toString(),
    })),
    inactivePicklistsToBackupAndDelete: inactivePicklists.length,
    missing: missing.length + missingClones.length,
  }, null, 2));

  if (missing.length || missingClones.length) {
    throw new Error('GST migration blocked: one or more source mappings or target subcategories is missing.');
  }
  if (!applyRequested) {
    console.log(`Dry run complete. No rows changed. Apply requires --apply --confirm=${CONFIRMATION}.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const beforeProducts = await tx.product.aggregate({
      _count: { _all: true },
      _sum: {
        quantity: true,
        availablequantity: true,
        soldquantity: true,
        ecompublishedquantity: true,
      },
    });
    const beforePlatform = await tx.platformStock.groupBy({
      by: ['platform'],
      _sum: { availableqty: true, totalqty: true },
      orderBy: { platform: 'asc' },
    });

    if (duplicateTransformations.length) {
      await tx.gstHsnMapping.deleteMany({
        where: { id: { in: duplicateTransformations.map(({ mapping }) => mapping!.id) } },
      });
    }

    for (const { mapping, target } of canonicalTransformations) {
      await tx.gstHsnMapping.update({
        where: { id: mapping!.id },
        data: {
          subcategory_id: target!.id,
          subcategory_value: target!.value,
          subsubcategory_id: null,
          subsubcategory_value: null,
          modifieddate: BigInt(Date.now()),
        },
      });
    }

    for (const clone of clonePlan) {
      if (clone.existing) continue;
      await tx.gstHsnMapping.create({
        data: {
          subcategory_id: clone.target!.id,
          subcategory_value: clone.target!.value,
          subsubcategory_id: null,
          subsubcategory_value: null,
          hsn_code: clone.source!.hsn_code,
          gst_rate: clone.source!.gst_rate,
          description: clone.description,
          isactive: true,
          createddate: BigInt(Date.now()),
          modifieddate: BigInt(Date.now()),
        },
      });
    }

    const inactiveIds = inactivePicklists.map((row) => row.id);
    const remainingReferences = await tx.gstHsnMapping.count({
      where: {
        OR: [
          { subcategory_id: { in: inactiveIds } },
          { subsubcategory_id: { in: inactiveIds } },
        ],
      },
    });
    if (remainingReferences) {
      throw new Error(`GST migration left ${remainingReferences} reference(s) to inactive picklists.`);
    }

    if (inactivePicklists.length) {
      await tx.picklistBackup.createMany({
        data: inactivePicklists.map((row) => ({
          id: row.id,
          label: row.label,
          value: row.value,
          object: row.object,
          controlledvalue: row.controlledvalue,
          fieldname: row.fieldname,
          controlledlabel: row.controlledlabel,
          controlledfieldname: row.controlledfieldname,
          parent: row.parent,
          description: row.description,
          sortorder: row.sortorder,
          isactive: row.isactive,
          createddate: row.createddate,
          modifieddate: row.modifieddate,
        })),
      });
      const deleted = await tx.picklist.deleteMany({ where: { id: { in: inactiveIds } } });
      if (deleted.count !== inactivePicklists.length) {
        throw new Error('Inactive picklist cleanup count did not match the migration plan.');
      }
    }

    for (const [subcategory, hsnCode, gstRate] of requiredProductMappings) {
      const valid = await tx.gstHsnMapping.findFirst({
        where: {
          subcategory_value: subcategory,
          subcategory_id: { not: null },
          subsubcategory_id: null,
          hsn_code: hsnCode,
          gst_rate: gstRate,
          isactive: true,
        },
      });
      if (!valid) {
        throw new Error(`Required GST mapping missing for ${subcategory}.`);
      }
    }

    const [afterProducts, afterPlatform] = await Promise.all([
      tx.product.aggregate({
        _count: { _all: true },
        _sum: {
          quantity: true,
          availablequantity: true,
          soldquantity: true,
          ecompublishedquantity: true,
        },
      }),
      tx.platformStock.groupBy({
        by: ['platform'],
        _sum: { availableqty: true, totalqty: true },
        orderBy: { platform: 'asc' },
      }),
    ]);
    const serialize = (value: unknown) =>
      JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item));
    if (serialize(beforeProducts) !== serialize(afterProducts) || serialize(beforePlatform) !== serialize(afterPlatform)) {
      throw new Error('Inventory invariant failed; GST migration was rolled back.');
    }
  }, { timeout: 60_000 });

  console.log('GST taxonomy migration and inactive picklist cleanup committed successfully.');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
