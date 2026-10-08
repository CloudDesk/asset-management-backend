/**
 * Sync the SIT picklist and GST/HSN mappings from UAT.
 *
 * Plan: docs/SIT_PICKLIST_FROM_UAT_DRY_RUN_2026-10-07.md
 *
 * - Matched picklist rows (object + fieldname + value + parent) keep their SIT id and take UAT attributes.
 * - Product Fragrance Type dependency metadata is normalized to Subcategory before it is written to SIT.
 * - UAT-only picklist rows are inserted with new SIT ids.
 * - SIT-only picklist rows are deleted after their approved dependants are handled:
 *   product fragrance tokens are replaced, category images are deleted, LOVs are deactivated.
 * - UAT gst_hsn_mapping rows are upserted by subcategory/subsubcategory value, with ids resolved to SIT picklist ids.
 * - Products are never created; only fragrance tokens listed in FRAGRANCE_REPLACEMENTS change.
 *
 * Dry-run (default): every change runs inside one transaction, is validated, then rolled back.
 *   npx tsx scripts/sync-sit-picklist-from-uat.ts
 * Apply:
 *   npx tsx scripts/sync-sit-picklist-from-uat.ts --apply --confirm=NIVAANA_SIT_PICKLIST_SYNC
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const CONFIRMATION = 'NIVAANA_SIT_PICKLIST_SYNC';
const SOURCE_DATABASE = 'assetmanagement_uat';
const TARGET_DATABASE = 'assetmanagement_dev';

// Approved on 2026-10-08: closest UAT incense fragrance.
const FRAGRANCE_REPLACEMENTS: Record<string, string> = {
  rose_bliss: 'floral_valley',
  sandalwood_serenity: 'royal_sandal',
};
// Approved on 2026-10-08: dependants of SIT-only picklist rows.
const APPROVED_CATEGORY_IMAGE_DELETES = [15, 17];
const APPROVED_LOV_DEACTIVATIONS = [77];

const PICKLIST_ATTRIBUTES = [
  'label',
  'controlledvalue',
  'controlledlabel',
  'controlledfieldname',
  'description',
  'sortorder',
  'isactive',
  'createddate',
  'modifieddate',
] as const;
const PICKLIST_COMPARED = PICKLIST_ATTRIBUTES.filter((c) => c !== 'createddate' && c !== 'modifieddate');

type PicklistRow = {
  id: number;
  object: string | null;
  fieldname: string | null;
  value: string | null;
  parent: string | null;
} & Record<(typeof PICKLIST_ATTRIBUTES)[number], unknown>;

type HsnRow = {
  id: number;
  subcategory_id: number | null;
  subcategory_value: string | null;
  subsubcategory_id: number | null;
  subsubcategory_value: string | null;
  hsn_code: string;
  gst_rate: string;
  description: string | null;
  isactive: boolean | null;
  createddate: string | null;
  modifieddate: string | null;
};

const apply = process.argv.includes('--apply');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.split('=')[1];
const argValue = (name: string, fallback: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const logLines: string[] = [];
const log = (line = '') => {
  console.log(line);
  logLines.push(line);
};

function readDatabaseUrl(envFile: string): string {
  const content = fs.readFileSync(path.resolve(backendRoot, envFile), 'utf8');
  const match = content.match(/^DATABASE_URL\s*[:=]\s*"?([^"\n]+)"?/m);
  if (!match) throw new Error(`DATABASE_URL not found in ${envFile}`);
  return match[1]
    .trim()
    .replace(/&?(connection_limit|pool_timeout)=\d+/g, '')
    .replace('sslmode=require', 'sslmode=no-verify');
}

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
const keyOf = (r: Pick<PicklistRow, 'object' | 'fieldname' | 'value' | 'parent'>) =>
  [norm(r.object), norm(r.fieldname), norm(r.value), norm(r.parent)].join('|');
const same = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');
const splitTokens = (v: string | null) =>
  (v ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
const notApproved = (ids: number[], approved: number[]) => ids.filter((id) => !approved.includes(id));

function normalizeFragranceDependencies(rows: PicklistRow[]): number {
  const subcategoryLabels = new Map(
    rows
      .filter(
        (row) =>
          norm(row.object) === 'product' &&
          norm(row.fieldname) === 'subcategory' &&
          row.isactive === true &&
          row.value,
      )
      .map((row) => [norm(row.value), String(row.label ?? row.value)]),
  );
  let changed = 0;
  for (const row of rows) {
    if (norm(row.object) !== 'product' || norm(row.fieldname) !== 'fragnancetype') continue;
    const parent = norm(row.parent);
    const label = subcategoryLabels.get(parent);
    if (!parent || !label) {
      throw new Error(`UAT Fragrance Type ${row.id}:${row.value} has no active Subcategory parent ${row.parent}`);
    }
    if (
      row.controlledfieldname !== 'subcategory' ||
      row.controlledvalue !== row.parent ||
      row.controlledlabel !== label
    ) {
      changed++;
      row.controlledfieldname = 'subcategory';
      row.controlledvalue = row.parent;
      row.controlledlabel = label;
    }
  }
  return changed;
}

function indexByKey(rows: PicklistRow[], label: string) {
  const map = new Map<string, PicklistRow>();
  for (const row of rows) {
    const key = keyOf(row);
    if (map.has(key)) throw new Error(`${label} has duplicate picklist key ${key}`);
    map.set(key, row);
  }
  return map;
}

async function connect(envFile: string, expectedDatabase: string) {
  const client = new pg.Client({ connectionString: readDatabaseUrl(envFile) });
  await client.connect();
  const { rows } = await client.query<{ db: string }>('select current_database() as db');
  if (rows[0].db !== expectedDatabase) {
    await client.end();
    throw new Error(`${envFile} points to ${rows[0].db}, expected ${expectedDatabase}`);
  }
  return client;
}

async function main() {
  if (apply && confirmation !== CONFIRMATION) {
    throw new Error(`--apply requires --confirm=${CONFIRMATION}`);
  }
  const startedAt = new Date();
  const nowSeconds = Math.floor(startedAt.getTime() / 1000);
  log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN (rolled back)'}  Started: ${startedAt.toISOString()}`);

  const source = await connect(argValue('source-env', '.env.uat'), SOURCE_DATABASE);
  const target = await connect(argValue('target-env', '.env.sit'), TARGET_DATABASE);

  try {
    // ── Source (UAT), read-only snapshot ──
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const uatPicklist = (await source.query<PicklistRow>('select * from picklist order by id')).rows;
    const uatHsnAll = (await source.query<HsnRow>('select * from gst_hsn_mapping order by id')).rows;
    await source.query('COMMIT');
    const normalizedFragranceDependencies = normalizeFragranceDependencies(uatPicklist);
    // SIT's hsn_code/gst_rate are NOT NULL (as in schema.prisma); UAT has incomplete rows that SIT cannot hold.
    const uatHsn = uatHsnAll.filter((r) => r.hsn_code != null && r.gst_rate != null);
    const uatHsnSkipped = uatHsnAll.filter((r) => !uatHsn.includes(r));
    const uatByKey = indexByKey(uatPicklist, 'UAT');
    const uatById = new Map(uatPicklist.map((r) => [r.id, r]));
    log(`UAT: ${uatPicklist.length} picklist rows, ${uatHsnAll.length} HSN rows (${uatHsn.length} complete)`);
    log(`UAT Fragrance Type dependencies normalized in memory: ${normalizedFragranceDependencies}`);
    log(
      `UAT HSN skipped, null hsn_code/gst_rate (${uatHsnSkipped.length}): ${
        uatHsnSkipped.map((r) => `${r.subcategory_value} ${r.hsn_code}@${r.gst_rate}`).join('; ') || 'none'
      }`,
    );

    // ── Target (SIT) ──
    await target.query('BEGIN');
    await target.query('LOCK TABLE picklist, gst_hsn_mapping, category_images, lovs IN SHARE ROW EXCLUSIVE MODE');

    if (apply) {
      const backup = {
        backupInfo: { database: TARGET_DATABASE, takenAtUtc: startedAt.toISOString(), purpose: 'pre-apply backup' },
        picklist: (await target.query('select * from picklist order by id')).rows,
        category_images: (await target.query('select * from category_images order by id')).rows,
        gst_hsn_mapping: (await target.query('select * from gst_hsn_mapping order by id')).rows,
        lovs: (await target.query('select * from lovs order by id')).rows,
        product_taxonomy: (
          await target.query(
            'select id, shortname, category, subcategory, subsubcategory, fragnancetype from product order by id',
          )
        ).rows,
      };
      const backupFile = path.join(
        backendRoot,
        'scripts/dryrun-logs',
        `sit-picklist-pre-apply-${startedAt.toISOString().replace(/[:.]/g, '-')}.json`,
      );
      fs.mkdirSync(path.dirname(backupFile), { recursive: true });
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      log(`Backup written: ${backupFile}`);
    }

    const sitPicklist = (await target.query<PicklistRow>('select * from picklist order by id')).rows;
    const sitByKey = indexByKey(sitPicklist, 'SIT');
    // lovs is not read by any app code and already holds stale picklist ids; only new orphans are an error.
    const activeOrphanLovIds = async () =>
      (
        await target.query<{ id: number }>(
          `select l.id from lovs l where l.isactive and l.source_picklist_id is not null
           and not exists (select 1 from picklist p where p.id = l.source_picklist_id)`,
        )
      ).rows.map((r) => r.id);
    const orphanLovsBefore = await activeOrphanLovIds();
    log(`SIT before: ${sitPicklist.length} picklist rows, ${orphanLovsBefore.length} active LOVs already orphaned`);

    // 1. Matched rows keep SIT id, take UAT attributes. UAT-only rows are inserted.
    const uatToSitId = new Map<number, number>();
    let updated = 0;
    const inserted: string[] = [];
    for (const uatRow of uatPicklist) {
      const sitRow = sitByKey.get(keyOf(uatRow));
      const values = PICKLIST_ATTRIBUTES.map((c) => uatRow[c]);
      if (sitRow) {
        uatToSitId.set(uatRow.id, sitRow.id);
        if (PICKLIST_COMPARED.some((c) => !same(sitRow[c], uatRow[c]))) updated++;
        await target.query(
          `update picklist set ${PICKLIST_ATTRIBUTES.map((c, i) => `${c} = $${i + 1}`).join(', ')}
           where id = $${PICKLIST_ATTRIBUTES.length + 1}`,
          [...values, sitRow.id],
        );
      } else {
        const { rows } = await target.query<{ id: number }>(
          `insert into picklist (object, fieldname, value, parent, ${PICKLIST_ATTRIBUTES.join(', ')})
           values ($1, $2, $3, $4, ${PICKLIST_ATTRIBUTES.map((_, i) => `$${i + 5}`).join(', ')})
           returning id`,
          [uatRow.object, uatRow.fieldname, uatRow.value, uatRow.parent, ...values],
        );
        uatToSitId.set(uatRow.id, rows[0].id);
        inserted.push(`${rows[0].id}:${uatRow.fieldname}=${uatRow.value} (parent ${uatRow.parent ?? '-'})`);
      }
    }
    log(`Picklist matched: ${uatToSitId.size - inserted.length}, attribute updates: ${updated}`);
    log(`Picklist inserted (${inserted.length}): ${inserted.join('; ') || 'none'}`);

    // 2. Product fragrance tokens.
    const fragranceProducts = (
      await target.query<{ id: number; shortname: string; fragnancetype: string | null }>(
        `select id, shortname, fragnancetype from product where fragnancetype is not null and fragnancetype <> '' for update`,
      )
    ).rows;
    for (const product of fragranceProducts) {
      const tokens = splitTokens(product.fragnancetype);
      if (!tokens.some((t) => t in FRAGRANCE_REPLACEMENTS)) continue;
      const next = [...new Set(tokens.map((t) => FRAGRANCE_REPLACEMENTS[t] ?? t))].join(',');
      await target.query('update product set fragnancetype = $1, modifieddate = $2 where id = $3', [
        next,
        nowSeconds,
        product.id,
      ]);
      log(`Product ${product.id} (${product.shortname}): ${product.fragnancetype} -> ${next}`);
    }

    // 3. SIT-only picklist rows and their dependants.
    const sitOnly = sitPicklist.filter((r) => !uatByKey.has(keyOf(r)));
    const sitOnlyIds = sitOnly.map((r) => r.id);
    log(`SIT-only picklist rows (${sitOnly.length}): ${sitOnly.map((r) => `${r.id}:${r.fieldname}=${r.value}`).join('; ')}`);

    const images = (
      await target.query<{ id: number }>('select id from category_images where picklistid = any($1::int[])', [sitOnlyIds])
    ).rows.map((r) => r.id);
    if (notApproved(images, APPROVED_CATEGORY_IMAGE_DELETES).length) {
      throw new Error(`Category images on SIT-only rows are [${images}], approved [${APPROVED_CATEGORY_IMAGE_DELETES}]`);
    }
    const lovs = (
      await target.query<{ id: number }>('select id from lovs where source_picklist_id = any($1::int[])', [sitOnlyIds])
    ).rows.map((r) => r.id);
    if (notApproved(lovs, APPROVED_LOV_DEACTIVATIONS).length) {
      throw new Error(`LOVs on SIT-only rows are [${lovs}], approved [${APPROVED_LOV_DEACTIVATIONS}]`);
    }
    const hsnOnSitOnly = (
      await target.query<{ id: number }>(
        'select id from gst_hsn_mapping where subcategory_id = any($1::int[]) or subsubcategory_id = any($1::int[])',
        [sitOnlyIds],
      )
    ).rows;
    if (hsnOnSitOnly.length) {
      throw new Error(`HSN rows reference SIT-only picklist ids: ${hsnOnSitOnly.map((r) => r.id)}`);
    }

    await target.query('delete from category_images where id = any($1::int[])', [images]);
    log(`Category images deleted: [${images}] (storage objects are not deleted)`);
    await target.query('update lovs set isactive = false, modifieddate = $2 where id = any($1::int[])', [lovs, nowSeconds]);
    log(`LOVs deactivated: [${lovs}]`);
    await target.query('delete from picklist where id = any($1::int[])', [sitOnlyIds]);
    log(`Picklist rows deleted: ${sitOnlyIds.length}`);
    await target.query(`select setval('picklist_id_seq', (select max(id) from picklist))`);

    // 4. GST/HSN mappings from UAT, ids resolved to SIT picklist ids.
    const resolve = (uatId: number | null, label: string) => {
      if (uatId == null) return null;
      const sitId = uatToSitId.get(uatId);
      if (sitId == null) throw new Error(`UAT HSN ${label} id ${uatId} has no SIT picklist row`);
      return sitId;
    };
    const sitHsn = (await target.query<HsnRow>('select * from gst_hsn_mapping order by id')).rows;
    const hsnKey = (r: HsnRow) => `${norm(r.subcategory_value)}|${norm(r.subsubcategory_value)}`;
    const sitHsnByKey = new Map(sitHsn.map((r) => [hsnKey(r), r]));
    await target.query(`select setval('gst_hsn_mapping_id_seq', (select coalesce(max(id), 1) from gst_hsn_mapping))`);
    let hsnUpdated = 0;
    const hsnInserted: string[] = [];
    for (const uatRow of uatHsn) {
      const values = [
        resolve(uatRow.subcategory_id, 'subcategory'),
        uatRow.subcategory_value,
        resolve(uatRow.subsubcategory_id, 'subsubcategory'),
        uatRow.subsubcategory_value,
        uatRow.hsn_code,
        uatRow.gst_rate,
        uatRow.description,
        uatRow.isactive,
        uatRow.modifieddate,
      ];
      const existing = sitHsnByKey.get(hsnKey(uatRow));
      if (existing) {
        await target.query(
          `update gst_hsn_mapping set subcategory_id = $1, subcategory_value = $2, subsubcategory_id = $3,
             subsubcategory_value = $4, hsn_code = $5, gst_rate = $6, description = $7, isactive = $8, modifieddate = $9
           where id = $10`,
          [...values, existing.id],
        );
        hsnUpdated++;
      } else {
        const { rows } = await target.query<{ id: number }>(
          `insert into gst_hsn_mapping (subcategory_id, subcategory_value, subsubcategory_id, subsubcategory_value,
             hsn_code, gst_rate, description, isactive, modifieddate, createddate)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
          [...values, uatRow.createddate],
        );
        hsnInserted.push(`${rows[0].id}:${uatRow.subcategory_value} ${uatRow.hsn_code}@${uatRow.gst_rate}%`);
      }
    }
    const sitHsnOnly = sitHsn.filter((r) => !uatHsn.some((u) => hsnKey(u) === hsnKey(r)));    log(`HSN updated: ${hsnUpdated}, inserted (${hsnInserted.length}): ${hsnInserted.join('; ') || 'none'}`);
    if (sitHsnOnly.length) {
      log(`SIT HSN rows left untouched: ${sitHsnOnly.map((r) => `${r.id}:${r.subcategory_value} ${r.hsn_code}@${r.gst_rate}`)}`);
    }

    // 5. Validation.
    const errors: string[] = [];
    const finalPicklist = (await target.query<PicklistRow>('select * from picklist order by id')).rows;
    const finalByKey = indexByKey(finalPicklist, 'SIT after');
    if (finalPicklist.length !== uatPicklist.length) {
      errors.push(`picklist count ${finalPicklist.length} != UAT ${uatPicklist.length}`);
    }
    for (const [key, uatRow] of uatByKey) {
      const row = finalByKey.get(key);
      if (!row) errors.push(`missing picklist key ${key}`);
      else for (const c of PICKLIST_COMPARED) if (!same(row[c], uatRow[c])) errors.push(`picklist ${row.id}.${c} differs from UAT`);
    }

    const finalHsn = (
      await target.query<HsnRow & { sub_value: string | null; subsub_value: string | null }>(
        `select g.*, p.value as sub_value, s.value as subsub_value from gst_hsn_mapping g
         left join picklist p on p.id = g.subcategory_id left join picklist s on s.id = g.subsubcategory_id`,
      )
    ).rows;
    for (const uatRow of uatHsn) {
      const row = finalHsn.find((r) => hsnKey(r) === hsnKey(uatRow));
      if (!row) errors.push(`missing HSN ${hsnKey(uatRow)}`);
      else if (row.hsn_code !== uatRow.hsn_code || !same(Number(row.gst_rate), Number(uatRow.gst_rate))) {
        errors.push(`HSN ${row.id} code/rate differs from UAT`);
      }
    }
    for (const row of finalHsn) {
      if (row.subcategory_value && !same(row.sub_value, row.subcategory_value)) {
        errors.push(`HSN ${row.id} subcategory_id ${row.subcategory_id} value ${row.sub_value} != ${row.subcategory_value}`);
      }
      if (row.subsubcategory_value && !same(row.subsub_value, row.subsubcategory_value)) {
        errors.push(`HSN ${row.id} subsubcategory_id/value mismatch`);
      }
    }

    const has = (fieldname: string, value: string, parent?: string) =>
      finalPicklist.some(
        (p) =>
          norm(p.fieldname) === fieldname &&
          norm(p.value) === norm(value) &&
          (parent === undefined || norm(p.parent) === norm(parent)),
      );
    const products = (
      await target.query<{
        id: number;
        category: string | null;
        subcategory: string | null;
        subsubcategory: string | null;
        fragnancetype: string | null;
      }>('select id, category, subcategory, subsubcategory, fragnancetype from product order by id')
    ).rows;
    for (const p of products) {
      if (p.category && !has('category', p.category)) errors.push(`product ${p.id} category ${p.category} missing`);
      if (p.subcategory && !has('subcategory', p.subcategory, p.category ?? '')) {
        errors.push(`product ${p.id} subcategory ${p.subcategory} not under ${p.category}`);
      }
      if (p.subsubcategory && !has('subsubcategory', p.subsubcategory)) {
        errors.push(`product ${p.id} subsubcategory ${p.subsubcategory} missing`);
      }
      for (const token of splitTokens(p.fragnancetype)) {
        if (!has('fragnancetype', token)) errors.push(`product ${p.id} fragrance ${token} missing`);
      }
    }

    const newOrphanLovs = (await activeOrphanLovIds()).filter((id) => !orphanLovsBefore.includes(id));
    if (newOrphanLovs.length) errors.push(`active LOVs newly pointing at missing picklist: ${newOrphanLovs}`);

    log(`SIT after: ${finalPicklist.length} picklist rows, ${finalHsn.length} HSN rows, ${products.length} products checked`);
    if (errors.length) {
      errors.forEach((e) => log(`ERROR ${e}`));
      throw new Error(`Validation failed with ${errors.length} error(s); rolled back`);
    }
    log('Validation passed');

    if (apply) {
      await target.query('COMMIT');
      log('COMMITTED');
    } else {
      await target.query('ROLLBACK');
      log('Dry-run complete; ROLLED BACK');
    }
  } catch (error) {
    await target.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await source.end();
    await target.end();
    const logFile = path.join(
      backendRoot,
      'scripts/dryrun-logs',
      `sit-picklist-sync-${apply ? 'apply' : 'dryrun'}-${startedAt.toISOString().replace(/[:.]/g, '-')}.txt`,
    );
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, `${logLines.join('\n')}\n`);
    console.log(`Log: ${logFile}`);
  }
}

main().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
