const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

// `String.fromCodePoint` throws on anything above U+10FFFF, and lone surrogates are
// malformed UTF-16. Both stay as the original entity text rather than taking down the
// render for one bad field.
const isDecodableCodePoint = (code: number): boolean => Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);

export const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return isDecodableCodePoint(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

// Some API fields (e.g. protocol text) arrive HTML-entity-encoded: no real tags,
// just `&lt;p&gt;…`. Rendering that in a WebView shows literal markup, so decode
// it first — but only when there are no actual tags in the string.
export const looksHtmlEncoded = (value: string): boolean => !/<[a-z!/]/i.test(value) && /&(lt|#0*60|#x0*3c);/i.test(value);

export const decodeHtmlEntitiesIfEncoded = (value: string): string => (looksHtmlEncoded(value) ? decodeHtmlEntities(value) : value);
