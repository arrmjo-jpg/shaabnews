import { describe, expect, it } from 'vitest';
import { InvalidExternalIdError } from '../domain/exceptions';
import { parseExternalId } from './externalIdMapper';

describe('parseExternalId', () => {
  it('يحوّل نصاً رقمياً صحيحاً إلى رقم', () => {
    expect(parseExternalId('1')).toBe(1);
    expect(parseExternalId('5930')).toBe(5930);
  });

  it('يرمي InvalidExternalIdError لنص غير رقمي', () => {
    expect(() => parseExternalId('abc')).toThrow(InvalidExternalIdError);
  });

  it('يرمي InvalidExternalIdError لصفر أو رقم سالب أو عشري', () => {
    expect(() => parseExternalId('0')).toThrow(InvalidExternalIdError);
    expect(() => parseExternalId('-1')).toThrow(InvalidExternalIdError);
    expect(() => parseExternalId('1.5')).toThrow(InvalidExternalIdError);
  });

  it('يرمي InvalidExternalIdError لنص فارغ', () => {
    expect(() => parseExternalId('')).toThrow(InvalidExternalIdError);
  });
});
