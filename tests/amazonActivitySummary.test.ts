import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeScheduledImports } from '../src/services/amazon-operations.service.ts';

// Activity tab: the every-15-minutes order imports become one line instead of filling the list
test('scheduled imports are summarised: runs, failures, latest run and its result', () => {
  const at = (minutesAgo: number) => new Date(Date.UTC(2026, 9, 22, 12, 0) - minutesAgo * 60_000);
  const summary = summarizeScheduledImports([
    { status: 'COMPLETED', createdAt: at(15), finishedAt: at(14) },
    { status: 'FAILED', createdAt: at(30), finishedAt: at(29) },
    { status: 'COMPLETED', createdAt: at(45), finishedAt: null },
  ]);
  assert.equal(summary.runs, 3);
  assert.equal(summary.failed, 1);
  assert.equal(summary.lastStatus, 'COMPLETED');
  assert.equal(summary.lastRunAt, '2026-10-22T11:46:00.000Z'); // the newest job's finish time
});

test('no scheduled imports gives an empty summary', () => {
  assert.deepEqual(summarizeScheduledImports([]), { runs: 0, failed: 0, lastRunAt: null, lastStatus: null });
});
