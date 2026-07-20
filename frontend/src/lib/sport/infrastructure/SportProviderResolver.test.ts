import { describe, expect, it } from 'vitest';
import { UnknownProviderError } from '../domain/exceptions';
import { Scores365Adapter } from './Scores365Adapter';
import { SportProviderResolver } from './SportProviderResolver';

describe('SportProviderResolver', () => {
  it('يحلّ "365scores" إلى نسخة من Scores365Adapter', () => {
    const provider = SportProviderResolver('365scores');
    expect(provider).toBeInstanceOf(Scores365Adapter);
  });

  it('يرمي UnknownProviderError لمزوّد غير مسجَّل', () => {
    expect(() => SportProviderResolver('unknown-provider')).toThrow(UnknownProviderError);
  });
});
