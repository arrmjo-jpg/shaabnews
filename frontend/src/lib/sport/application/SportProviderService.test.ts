import { describe, expect, it } from 'vitest';
import { InvalidExternalIdError, UnknownProviderError } from '../domain/exceptions';
import { Scores365Adapter } from '../infrastructure/Scores365Adapter';
import { resolveSportProvider } from './SportProviderService';

describe('resolveSportProvider', () => {
  it('يحلّ provider/external_id صحيحين إلى مزوّد ومعرّف رقمي جاهزين', () => {
    const { provider, externalId } = resolveSportProvider({ provider: '365scores', external_id: '1' });
    expect(provider).toBeInstanceOf(Scores365Adapter);
    expect(externalId).toBe(1);
  });

  it('يرمي UnknownProviderError عندما يكون provider غير مسجَّل', () => {
    expect(() => resolveSportProvider({ provider: 'nope', external_id: '1' })).toThrow(UnknownProviderError);
  });

  it('يرمي InvalidExternalIdError عندما يكون external_id غير رقمي', () => {
    expect(() => resolveSportProvider({ provider: '365scores', external_id: 'abc' })).toThrow(InvalidExternalIdError);
  });
});
