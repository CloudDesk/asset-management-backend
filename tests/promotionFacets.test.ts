import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFacetOptions } from '../src/services/promotions-v2.service.js';

// FIX-2026-10-15-117: category / subcategory options come from the picklist,
// not from loaded products.
const entry = (fieldname: string, value: string, label: string, isactive = true) => ({ fieldname, value, label, isactive });

test('every active picklist subcategory is listed, any number of them, with 0 for empty ones', () => {
  const picklist = Array.from({ length: 150 }, (_, index) => entry('subcategory', `sub_${index + 1}`, `Subcategory ${String(index + 1).padStart(3, '0')}`));
  const options = buildFacetOptions('subcategory', picklist, [{ value: 'sub_7', count: 4 }]);
  assert.equal(options.length, 150);
  assert.deepEqual(options.find((option) => option.id === 'sub_7'), { id: 'sub_7', label: 'Subcategory 007', count: 4 });
  assert.equal(options.filter((option) => option.count === 0).length, 149);
  assert.equal(options[0]!.label, 'Subcategory 001');
});

test('picklist entries for the other field are ignored', () => {
  const options = buildFacetOptions('category', [entry('subcategory', 'reed', 'Reed'), entry('category', 'incense_rituals', 'Incense & Rituals')], []);
  assert.deepEqual(options, [{ id: 'incense_rituals', label: 'Incense & Rituals', count: 0 }]);
});

test('a product value missing from the picklist is still listed under its stored name', () => {
  const options = buildFacetOptions('category', [entry('category', 'incense_rituals', 'Incense & Rituals')], [
    { value: 'Incense_Rituals', count: 3 },
    { value: 'old_category', count: 2 },
    { value: null, count: 5 },
  ]);
  assert.deepEqual(options, [
    { id: 'incense_rituals', label: 'Incense & Rituals', count: 3 },
    { id: 'old_category', label: 'old_category', count: 2 },
  ]);
});

test('an inactive picklist entry shows only while products still use it', () => {
  const picklist = [entry('subcategory', 'retired_empty', 'Retired Empty', false), entry('subcategory', 'retired_used', 'Retired Used', false)];
  assert.deepEqual(buildFacetOptions('subcategory', picklist, [{ value: 'retired_used', count: 1 }]), [
    { id: 'retired_used', label: 'Retired Used', count: 1 },
  ]);
});
