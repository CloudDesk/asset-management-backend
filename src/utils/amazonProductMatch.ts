// Name matching for Amazon listing → Nivaana product suggestions (FIX-126).
// Only words that tell products apart count: filler words, packaging words and words that appear in
// many products (brand names such as NIVAANA / KRAFTELLA) are ignored, and rarer words weigh more.

const STOP_WORDS = new Set([
  'and', 'with', 'the', 'for', 'from', 'into', 'this', 'that', 'your', 'our', 'you', 'are', 'its', 'all',
  'new', 'best', 'premium', 'pure', 'natural', 'original', 'quality', 'long', 'lasting', 'low', 'high',
  'value', 'pack', 'packs', 'combo', 'set', 'sets', 'piece', 'pieces', 'pcs', 'pair', 'kit', 'box', 'try', 'out',
  'home', 'decor', 'gift', 'gifts', 'item', 'items', 'product', 'products', 'size', 'free',
]);

// A word in more than this share of the catalogue is treated as common (brand names, "incense", …)
const COMMON_WORD_SHARE = 0.1;
// Below this catalogue size word frequencies say little, so only STOP_WORDS are dropped
const MIN_CATALOG_FOR_FREQUENCY = 20;
// Full name coverage is worth this many points (title evidence alone stays below HIGH confidence)
const NAME_MATCH_MAX_SCORE = 70;
// Name score multiplier when fewer than two non-number words match
const SINGLE_WORD_FACTOR = 0.5;

const tokenize = (value?: string | null) =>
  (value ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 || /^\d+$/.test(word));

export type CatalogWordStats = {
  size: number;
  isCommon: (word: string) => boolean;
  weight: (word: string) => number;
};

export const buildCatalogWordStats = (productNames: string[]): CatalogWordStats => {
  const documentFrequency = new Map<string, number>();
  for (const name of productNames) {
    for (const word of new Set(tokenize(name))) {
      documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
    }
  }
  const size = productNames.length;
  return {
    size,
    isCommon: (word) => size >= MIN_CATALOG_FOR_FREQUENCY
      && (documentFrequency.get(word) ?? 0) / size > COMMON_WORD_SHARE,
    weight: (word) => Math.log(1 + size / Math.max(1, documentFrequency.get(word) ?? 0)),
  };
};

// Numbers (30 sticks vs 10 sticks, 100 ml) are kept even when common; they still weigh less when frequent
const isNumber = (word: string) => /^\d+$/.test(word);

export const keyWords = (value: string | null | undefined, stats: CatalogWordStats) =>
  new Set(tokenize(value).filter((word) => !STOP_WORDS.has(word) && (isNumber(word) || !stats.isCommon(word))));

// How much of the product's own distinctive name appears in the Amazon listing, weighted by rarity
export const scoreNameMatch = (productName: string, listingWords: Set<string>, stats: CatalogWordStats) => {
  const productWords = [...keyWords(productName, stats)];
  const matched = productWords.filter((word) => listingWords.has(word));
  if (productWords.length === 0 || matched.length === 0) return { score: 0, matched, total: productWords.length };
  const totalWeight = productWords.reduce((sum, word) => sum + stats.weight(word), 0);
  const matchedWeight = matched.reduce((sum, word) => sum + stats.weight(word), 0);
  // One shared word is thin evidence even when it is the product's only key word ("Incense Combo")
  const evidence = matched.filter((word) => !isNumber(word)).length >= 2 ? 1 : SINGLE_WORD_FACTOR;
  return { score: Math.round(NAME_MATCH_MAX_SCORE * (matchedWeight / totalWeight) * evidence), matched, total: productWords.length };
};
