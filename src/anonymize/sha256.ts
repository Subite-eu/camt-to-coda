/** Small synchronous SHA-256 for deterministic pseudonyms in browsers and Node.
 * No secret is implied: pseudonyms are linkable, and are not encryption. */
export function sha256(text: string): string {
  const bytes = Array.from(unescape(encodeURIComponent(text)), c => c.charCodeAt(0));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i < 4 ? (bitLength >>> (i * 8)) & 255 : 0);
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++) if (!primes.some(p => n % p === 0)) primes.push(n);
  const h = primes.slice(0, 8).map(p => (Math.sqrt(p) % 1 * 2 ** 32) | 0);
  const k = primes.map(p => (Math.cbrt(p) % 1 * 2 ** 32) | 0);
  const rr = (n: number, b: number) => (n >>> b) | (n << (32 - b));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w: number[] = [];
    for (let i = 0; i < 16; i++) { const o = offset + i * 4; w[i] = (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]; }
    for (let i = 16; i < 64; i++) w[i] = ((rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10)) + w[i-7] + (rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3)) + w[i-16]) | 0;
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (j + (rr(e,6)^rr(e,11)^rr(e,25)) + ((e&f)^(~e&g)) + k[i] + w[i]) | 0;
      const t2 = ((rr(a,2)^rr(a,13)^rr(a,22)) + ((a&b)^(a&c)^(b&c))) | 0;
      j=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,j].forEach((v,i) => { h[i]=(h[i]+v)|0; });
  }
  return h.map(v => (v>>>0).toString(16).padStart(8,"0")).join("");
}
