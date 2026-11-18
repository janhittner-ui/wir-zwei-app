/** "2 l Milch" → Menge "2 l", Text "Milch"; "Milch 2x" → "2x" */
export function splitQty(raw: string): { text: string; qty: string | null } {
  const s = raw.replace(/\s+/g, ' ').trim();
  const unit = '(?:x|stk\\.?|st\\.?|g|kg|ml|l|pck\\.?|pack|packung(?:en)?|dose(?:n)?|flasche(?:n)?|becher|bund|glas|gläser|tüte(?:n)?)';
  let m = s.match(new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${unit}?)\\s+(.+)$`, 'i'));
  if (m) return { qty: m[1], text: m[2] };
  m = s.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?\\s*${unit}?)$`, 'i'));
  if (m) return { text: m[1], qty: m[2] };
  return { text: s, qty: null };
}
