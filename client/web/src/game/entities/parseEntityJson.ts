/** Legacy Python exports used NaN for absent animation bounds. Preserve
 * strings verbatim and turn only non-finite JSON tokens into null; the
 * entity adapter then supplies its normal finite defaults. */
export function parseEntityJson(text: string): unknown {
  return JSON.parse(text.replace(/"(?:[^"\\]|\\.)*"|-?Infinity|NaN/g, token =>
    token.startsWith('"') ? token : 'null'))
}
