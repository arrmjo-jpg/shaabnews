// يحلّ سلسلة provider نصية إلى SportDataProvider (نوع الواجهة، لا الصنف المحدَّد أبداً) عبر
// providerConfig. سلسلة غير مسجَّلة = خطأ إعداد صريح (UnknownProviderError)، لا افتراض صامت.
import type { SportDataProvider } from '../domain/SportDataProvider';
import { UnknownProviderError } from '../domain/exceptions';
import { providerConfig } from './providerConfig';

export function SportProviderResolver(provider: string): SportDataProvider {
  const factory = providerConfig[provider];
  if (!factory) {
    throw new UnknownProviderError(provider);
  }
  return factory();
}
