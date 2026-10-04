import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProductSearchCondition } from './dynamicDbOperations.js';

test('product search combines full-text and partial matching for three-character prefixes', () => {
  const result = buildProductSearchCondition('  AuO  ', 4);

  assert.match(result.condition, /searchtext @@ plainto_tsquery\('english', \$4\)/);
  assert.match(result.condition, /LOWER\(COALESCE\(name, ''\)\) LIKE \$5/);
  assert.match(result.condition, /LOWER\(COALESCE\(shortname, ''\)\) LIKE \$5/);
  assert.match(result.condition, /LOWER\(COALESCE\(puc, ''\)\) LIKE \$5/);
  assert.match(result.condition, /LOWER\(COALESCE\(subcategory, ''\)\) LIKE \$5/);
  assert.deepEqual(result.values, ['auo', '%auo%']);
  assert.equal(result.nextParamIndex, 6);
});
