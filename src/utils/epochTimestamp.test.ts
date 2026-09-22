import assert from 'node:assert/strict';
import test from 'node:test';

import {
  epochToMilliseconds,
  normalizeLegacyIndiaShiftedEpochMilliseconds
} from './epochTimestamp.js';

test('normalizes epoch seconds and preserves epoch milliseconds', () => {
  assert.equal(epochToMilliseconds(1_790_000_000), 1_790_000_000_000);
  assert.equal(epochToMilliseconds(1_790_000_000_000), 1_790_000_000_000);
});

test('corrects a legacy Asia/Kolkata-shifted promotion timestamp', () => {
  const now = 1_790_000_000_000;
  const writtenThirtyMinutesAgoWithIndiaOffset =
    now - 30 * 60 * 1000 + 5.5 * 60 * 60 * 1000;

  assert.equal(
    normalizeLegacyIndiaShiftedEpochMilliseconds(
      writtenThirtyMinutesAgoWithIndiaOffset / 1000,
      now
    ),
    now - 30 * 60 * 1000
  );
});

test('does not change valid past or unrelated far-future timestamps', () => {
  const now = 1_790_000_000_000;
  assert.equal(
    normalizeLegacyIndiaShiftedEpochMilliseconds((now - 60_000) / 1000, now),
    now - 60_000
  );
  assert.equal(
    normalizeLegacyIndiaShiftedEpochMilliseconds((now + 24 * 60 * 60 * 1000) / 1000, now),
    now + 24 * 60 * 60 * 1000
  );
});
