// استثناءات مجالية: تُستخدَم فقط لأخطاء برمجية/إعداد حقيقية (provider غير معروف، external_id
// غير قابل للتحويل إلى رقم) — وليس لحالات "المزوّد الخارجي غير متاح مؤقتاً"، التي تبقى كما هي في
// games.ts/stats.ts/player.ts: فشل صامت يُرجع null/[] (اتفاقية "لا تلفيق" الموثّقة هناك).
export class SportDomainError extends Error {}

export class UnknownProviderError extends SportDomainError {
  constructor(provider: string) {
    super(`Unknown sport data provider: ${provider}`);
  }
}

export class InvalidExternalIdError extends SportDomainError {
  constructor(raw: string) {
    super(`external_id is not a valid numeric id: ${JSON.stringify(raw)}`);
  }
}
