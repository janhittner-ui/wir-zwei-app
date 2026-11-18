/**
 * Emoji vor jedem Einkaufs-Eintrag, automatisch aus den Wörtern gewählt (wie in Wir Zwei v40).
 * Das letzte bekannte Wort gewinnt ("Milchschokolade" → Schokolade), sonst irgendein bekanntes Wort, sonst 🛒.
 */
import { SHOP_EMOJI_SRC } from './shop-emoji-table';

const norm = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

const TABLE = (() => {
  const out: { k: string; emo: string; short: boolean; re: RegExp }[] = [];
  for (const line of SHOP_EMOJI_SRC.trim().split('\n')) {
    const [emo, ...words] = line.trim().split(/\s+/);
    for (const w of words) {
      const k = norm(w);
      const short = k.length <= 3;
      out.push({ k, emo, short, re: new RegExp(short ? `^${k}(?:er|s)?$` : `${k}(?:n|en|s|e|er|nen)?$`) });
    }
  }
  return out.sort((a, b) => b.k.length - a.k.length);
})();

const cache = new Map<string, string>();
export function shopEmoji(text: string): string {
  const hit = cache.get(text);
  if (hit) return hit;
  const n = norm(text);
  const toks = n.split(/[^a-z]+/).filter((t) => t.length > 1);
  let emo: string | undefined;
  for (let i = toks.length - 1; i >= 0 && !emo; i--) emo = TABLE.find((x) => x.re.test(toks[i]))?.emo;
  if (!emo) emo = TABLE.find((x) => !x.short && n.includes(x.k))?.emo;
  const r = emo ?? '🛒';
  cache.set(text, r);
  return r;
}
