import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRetainedManualPromotionCandidates,
  isPromotionConfiguredAutomatic,
  isPromotionUsageExhausted,
} from './promotionPolicy.js';

test('only explicitly automatic promotions qualify for automatic application', () => {
  assert.equal(isPromotionConfiguredAutomatic({ auto_apply: true, application_mode: 'automatic' }), true);
  assert.equal(isPromotionConfiguredAutomatic({ auto_apply: false, application_mode: 'automatic' }), false);
  assert.equal(isPromotionConfiguredAutomatic({ auto_apply: true, application_mode: 'click_to_apply' }), false);
  assert.equal(isPromotionConfiguredAutomatic({ auto_apply: true, application_mode: 'code_entry' }), false);
  assert.equal(isPromotionConfiguredAutomatic({ auto_apply: true }), false);
  assert.equal(isPromotionConfiguredAutomatic(undefined), false);
});

test('manual promotions are retained only for the exact same cart', () => {
  const applied = [
    { promotion_id: 1, is_auto: false },
    { promotion_id: 2, is_auto: true },
  ];

  assert.deepEqual(getRetainedManualPromotionCandidates(applied, true), [
    { promotion_id: 1, is_auto: false },
  ]);
  assert.deepEqual(getRetainedManualPromotionCandidates(applied, false), []);
});

test('a promotion is exhausted at every configured usage boundary', () => {
  const available = {
    customerPromotionUsage: 0,
    perCustomerLimit: 1,
    assignmentUsage: 0,
    assignmentLimit: 1,
    campaignUsage: 9,
    campaignLimit: 10,
  };

  assert.equal(isPromotionUsageExhausted(available), false);
  assert.equal(isPromotionUsageExhausted({ ...available, customerPromotionUsage: 1 }), true);
  assert.equal(isPromotionUsageExhausted({ ...available, assignmentUsage: 1 }), true);
  assert.equal(isPromotionUsageExhausted({ ...available, campaignUsage: 10 }), true);
});

test('missing usage limits do not exhaust a promotion', () => {
  assert.equal(isPromotionUsageExhausted({
    customerPromotionUsage: 50,
    assignmentUsage: 50,
    campaignUsage: 50,
  }), false);
});
