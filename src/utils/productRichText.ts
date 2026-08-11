import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
];

/**
 * Keep product copy portable between the web and native storefronts.
 * Legacy plain text is preserved; Word private-use bullets are normalized.
 */
export const sanitizeProductRichText = (value: string): string =>
  sanitizeHtml(value.replace(/\uF0A7/g, '•'), {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  }).trim();

