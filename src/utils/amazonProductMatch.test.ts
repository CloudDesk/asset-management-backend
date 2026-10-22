import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCatalogWordStats, keyWords, scoreNameMatch } from './amazonProductMatch.ts';

// Shaped like the real catalogue: many NIVAANA incense products, a smaller KRAFTELLA decor range
const CATALOG = [
  'NIVAANA - Spiritual Harmony - Value Pack - 30 Sticks',
  'NIVAANA - Spiritual Harmony - TRY-ME-OUT Pack - 10 Sticks',
  'NIVAANA - Incense Combo',
  'NIVAANA - Premium Incense sticks',
  'NIVAANA - A convenient combo featuring NIVAANA Rose Bliss and Sandalwood incense sticks with long lasting fragrance',
  'NIVAANA - Kasturi - Value Pack - 30 Sticks',
  'NIVAANA - Kesar Chandan - Value Pack - 30 Sticks',
  'NIVAANA - Black Oudh - Value Pack - 30 Sticks',
  'NIVAANA - Black Oudh - TRY-ME-OUT Pack - 10 Sticks',
  'NIVAANA - Dhoop Sticks',
  'NIVAANA - Teakwood - Diffuser Oil - 10 ml',
  'NIVAANA - Golden Dust - Diffuser Oil - 10 ml',
  'NIVAANA - Herbal Havan Cups',
  'NIVAANA - Sandalwood Havan Cups',
  'NIVAANA - Duck Showpiece',
  'NIVAANA - Rose Bliss - Value Pack - 30 Sticks',
  'KRAFTELLA - PARROT-BOOKSHELF-TEAL',
  'KRAFTELLA - FLAMINGO-GOLD TEAL',
  'KRAFTELLA - ELEPHANT-PAIR',
  'KRAFTELLA - LION-GOLD CROWN-WHITE',
  'KRAFTELLA - ELEPHANT-SMALL',
  'KRAFTELLA - ELEPHANT-LARGE',
  'KRAFTELLA - LION-BOOKSHELF-BLACK',
  'KRAFTELLA - Thermosteel Water bottle - 1000 ml - Blue',
];
const stats = buildCatalogWordStats(CATALOG);

const rank = (listingTitle: string) => {
  const listingWords = keyWords(listingTitle, stats);
  return CATALOG
    .map((name) => ({ name, ...scoreNameMatch(name, listingWords, stats) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.name.length - right.name.length);
};

test('brand, filler and packaging words are not key words', () => {
  const words = keyWords('NIVAANA Rose Bliss Incense Sticks with Value Pack', stats);
  for (const ignored of ['nivaana', 'with', 'value', 'pack', 'sticks']) assert.ok(!words.has(ignored), ignored);
  assert.ok(words.has('rose'));
  assert.ok(words.has('bliss'));
});

test('pack numbers stay as key words even when common', () => {
  assert.ok(keyWords('Value Pack - 30 Sticks', stats).has('30'));
});

test('the product whose whole name is in the Amazon title ranks first, the other pack size second', () => {
  const ranked = rank('Nivaana Spiritual Harmony Incense Sticks – Traditional Temple Aroma Blend with Sandalwood, Frankincense, Myrrh, Rose & Patchouli | Pure Ritual Fragrance, Low Smoke, Long-Lasting Agarbatti | 30 Sticks');
  assert.equal(ranked[0].name, 'NIVAANA - Spiritual Harmony - Value Pack - 30 Sticks');
  assert.equal(ranked[1].name, 'NIVAANA - Spiritual Harmony - TRY-ME-OUT Pack - 10 Sticks');
  assert.ok(ranked[0].score > ranked[1].score);
});

test('a long description-style product name does not beat a short exact one', () => {
  const ranked = rank('NIVAANA Rose Bliss Incense Sticks Value Pack 30 Sticks');
  assert.equal(ranked[0].name, 'NIVAANA - Rose Bliss - Value Pack - 30 Sticks');
});

test('a single shared word counts half, even when it is the whole key name', () => {
  const listingWords = keyWords('Traditional Dhoop Cones for Pooja', stats);
  const dhoop = scoreNameMatch('NIVAANA - Dhoop Sticks', listingWords, stats);
  assert.deepEqual(dhoop.matched, ['dhoop']);
  assert.equal(dhoop.score, 35);
});

test('a rare shared word (parrot) outweighs common colour words', () => {
  const ranked = rank('KRAFTELLA Parrot Pair Decorative Set, Teal Blue and Gold, Resin Material, Home Décor');
  assert.equal(ranked[0].name, 'KRAFTELLA - PARROT-BOOKSHELF-TEAL');
});

test('no shared key word gives no name score', () => {
  const listingWords = keyWords('Stainless steel lunch box', stats);
  assert.equal(scoreNameMatch('KRAFTELLA - ELEPHANT-SMALL', listingWords, stats).score, 0);
});

test('a small catalogue only drops stop words', () => {
  const small = buildCatalogWordStats(['NIVAANA - Rose', 'NIVAANA - Kasturi']);
  assert.ok(keyWords('NIVAANA Rose', small).has('nivaana'));
});
