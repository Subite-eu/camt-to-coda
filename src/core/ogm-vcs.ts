// Belgian OGM-VCS structured communication (FEBELFIN AOS1).
//
// Format: 12 digits, e.g. 010806817183 (visual +++010/8068/17183+++).
// The last 2 digits are check digits = (first 10 digits) mod 97; if the
// remainder is 0 the check digits are 97. In CAMT it is carried as
// RmtInf/Strd/CdtrRefInf with Tp/CdOrPrtry/Cd=SCOR and Issr=BBA.

/** mod-97 check value of the first 10 digits (0 maps to 97), per AOS1. */
export function mod97(first10: string): number {
  const r = Number(BigInt(first10) % 97n);
  return r === 0 ? 97 : r;
}

/** True if `ref` is structurally a 12-digit OGM-VCS candidate. */
export function isOgmVcs(ref: string): boolean {
  return /^\d{12}$/.test(ref);
}

/** True if `ref` is a 12-digit OGM-VCS with valid mod-97 check digits. */
export function isValidOgmVcs(ref: string): boolean {
  if (!isOgmVcs(ref)) return false;
  return mod97(ref.slice(0, 10)) === Number(ref.slice(10));
}

/** Render the visual +++ddd/dddd/ddddd+++ form of a 12-digit reference. */
export function formatVisual(ref12: string): string {
  return `+++${ref12.slice(0, 3)}/${ref12.slice(3, 7)}/${ref12.slice(7)}+++`;
}
