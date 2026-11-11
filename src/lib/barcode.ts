/**
 * Pure Code-128B Barcode encoder for SVG thermal label rendering.
 * Supports printable ASCII characters (0x20 to 0x7E) with Start Code B (104),
 * modulo-103 checksum, and Stop pattern (106).
 */

const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
] as const;

export interface Code128Bar {
  x: number;
  w: number;
}

/**
 * Compute Code-128B symbol codes (including Start B, Checksum, and Stop).
 */
export function encodeCode128BCodes(rawText: string): number[] {
  const clean = rawText.replace(/[^\x20-\x7E]/g, '') || '000000';
  const codes: number[] = [104]; // Start Code B
  let checksum = 104;
  for (let i = 0; i < clean.length; i++) {
    const val = clean.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop pattern
  return codes;
}

/**
 * Build horizontal SVG bar coordinates ({ x, w }) for a Code-128B barcode string.
 */
export function buildCode128Bars(rawText: string): Code128Bar[] {
  const codes = encodeCode128BCodes(rawText);
  const bars: Code128Bar[] = [];
  let cursor = 10; // Left quiet zone
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]);
      if (i % 2 === 0) {
        bars.push({ x: cursor, w: width });
      }
      cursor += width;
    }
  }
  return bars;
}
