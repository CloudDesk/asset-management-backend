import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

test('return credit note migration creates the required finance table and indexes', () => {
  const migration = readFileSync(
    resolve(root, 'prisma/migrations/20260801030000_add_return_credit_notes/migration.sql'),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS "return_credit_notes"/);
  assert.match(migration, /"credit_note_number" VARCHAR\(100\) NOT NULL UNIQUE/);
  assert.match(migration, /FOREIGN KEY \("return_request_id"\) REFERENCES "return_requests"\("id"\)/);
  assert.match(migration, /FOREIGN KEY \("resolution_action_id"\) REFERENCES "return_resolution_actions"\("id"\)/);
  assert.match(migration, /idx_return_credit_notes_request/);
  assert.match(migration, /idx_return_credit_notes_resolution_action/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
});

test('Prisma schema keeps credit notes linked to requests and resolution actions', () => {
  const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');

  assert.match(schema, /model ReturnCreditNote/);
  assert.match(schema, /creditNotes\s+ReturnCreditNote\[\]/);
  assert.match(schema, /returnRequest\s+ReturnRequest\s+@relation/);
  assert.match(schema, /resolutionAction\s+ReturnResolutionAction\?\s+@relation/);
  assert.match(schema, /@@map\("return_credit_notes"\)/);
});

test('return status timeline migration creates audit trail table and backfills existing requests', () => {
  const migration = readFileSync(
    resolve(root, 'prisma/migrations/20260801040000_add_return_status_timeline/migration.sql'),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS "return_status_timeline"/);
  assert.match(migration, /"previous_status" VARCHAR\(100\)/);
  assert.match(migration, /"event_type" VARCHAR\(100\) NOT NULL/);
  assert.match(migration, /FOREIGN KEY \("return_request_id"\) REFERENCES "return_requests"\("id"\)/);
  assert.match(migration, /idx_return_status_timeline_request/);
  assert.match(migration, /idx_return_status_timeline_status/);
  assert.match(migration, /idx_return_status_timeline_event_type/);
  assert.match(migration, /current_status_backfill/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
});

test('Prisma schema keeps status timeline linked to return requests', () => {
  const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');

  assert.match(schema, /model ReturnStatusTimeline/);
  assert.match(schema, /statusTimeline\s+ReturnStatusTimeline\[\]/);
  assert.match(schema, /previousStatus\s+String\?\s+@map\("previous_status"\)/);
  assert.match(schema, /eventType\s+String\s+@map\("event_type"\)/);
  assert.match(schema, /returnRequest\s+ReturnRequest\s+@relation/);
  assert.match(schema, /@@map\("return_status_timeline"\)/);
});
