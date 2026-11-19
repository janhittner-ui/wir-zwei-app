/** Base64 → Bytes (ohne Zusatzpaket; funktioniert auf iPhone, Android und im Web). */
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < ABC.length; i++) LOOKUP[ABC.charCodeAt(i)] = i;

export function base64ToBytes(b64: string): Uint8Array {
  const s = b64.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((s.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = LOOKUP[s.charCodeAt(i)];
    const b = LOOKUP[s.charCodeAt(i + 1)];
    const c = LOOKUP[s.charCodeAt(i + 2)];
    const d = LOOKUP[s.charCodeAt(i + 3)];
    out[p++] = (a << 2) | (b >> 4);
    if (i + 2 < s.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < s.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, p);
}
