// إعداد المزوّدين (Provider configuration): ما هي المزوّدات المسجَّلة، منفصلاً عن آليّة الحلّ
// نفسها في SportProviderResolver. مزوّد واحد فقط اليوم — التسجيل يجعل إضافة آخر لاحقاً تعديلاً في
// مكان واحد فقط، لا فرعاً جديداً مبعثراً داخل منطق الحلّ.
import type { SportDataProvider } from '../domain/SportDataProvider';
import { Scores365Adapter } from './Scores365Adapter';

export const providerConfig: Record<string, () => SportDataProvider> = {
  '365scores': () => new Scores365Adapter(),
};
