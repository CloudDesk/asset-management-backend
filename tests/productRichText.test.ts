import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeProductRichText } from '../src/utils/productRichText.js';

test('preserves supported product formatting', () => {
  const input = '<h2>Benefits</h2><ul><li><strong>Gentle</strong> cleansing</li></ul>';
  assert.equal(sanitizeProductRichText(input), input);
});

test('preserves legacy plain text and normalizes Word bullets', () => {
  assert.equal(sanitizeProductRichText('First\n\uF0A7 Second'), 'First\n• Second');
});

test('removes unsafe product markup and link protocols', () => {
  const result = sanitizeProductRichText(
    '<p onclick="alert(1)">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>',
  );

  assert.equal(result, '<p>Safe</p><a target="_blank" rel="noopener noreferrer">link</a>');
});
