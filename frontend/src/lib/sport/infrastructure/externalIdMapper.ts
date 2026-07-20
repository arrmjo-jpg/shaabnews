// طبقة الربط (mapping) بين provider/external_id في الـ CMS وواجهات games.ts/stats.ts/player.ts
// الرقمية. Category.external_id نصّي ونادر الوجود (nullable) — يُرفض بصراحة (استثناء) بدل
// parseInt الصامت الذي قد ينتج NaN ويُمرَّر كسِعة رقمية غير صالحة إلى المزوّد.
import { InvalidExternalIdError } from '../domain/exceptions';

export function parseExternalId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidExternalIdError(raw);
  }
  return n;
}
