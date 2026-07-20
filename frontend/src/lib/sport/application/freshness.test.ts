import { beforeEach, describe, expect, it } from 'vitest';
import { resetFreshnessStore, withFreshness } from './freshness';

const isEmptyArray = (v: unknown[]) => v.length === 0;

beforeEach(() => {
  resetFreshnessStore();
});

describe('withFreshness', () => {
  it('يُعيد freshness:"fresh" عند أول نجاح', async () => {
    const result = await withFreshness('k1', async () => [1, 2, 3], isEmptyArray);
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.freshness).toBe('fresh');
    expect(result.fetchedAt).toBeTruthy();
  });

  it('يُعيد النتيجة الفارغة بعلامة "fresh" عندما لا توجد نسخة ناجحة سابقة (لم ينجح قطّ)', async () => {
    const result = await withFreshness('k2', async () => [], isEmptyArray);
    expect(result.data).toEqual([]);
    expect(result.freshness).toBe('fresh');
  });

  it('يُعيد آخر نسخة ناجحة بعلامة "stale" عند فشل لاحق بعد نجاح سابق', async () => {
    const first = await withFreshness('k3', async () => [1, 2], isEmptyArray);
    const second = await withFreshness('k3', async () => [], isEmptyArray);

    expect(second.data).toEqual([1, 2]);
    expect(second.freshness).toBe('stale');
    expect(second.fetchedAt).toBe(first.fetchedAt);
  });

  it('يعود لعلامة "fresh" بعد نجاح جديد يتبع فشلاً', async () => {
    await withFreshness('k4', async () => [1], isEmptyArray);
    await withFreshness('k4', async () => [], isEmptyArray);
    const third = await withFreshness('k4', async () => [9, 9], isEmptyArray);

    expect(third.data).toEqual([9, 9]);
    expect(third.freshness).toBe('fresh');
  });

  it('مفاتيح مختلفة لا تتداخل مع بعضها', async () => {
    await withFreshness('a', async () => [1], isEmptyArray);
    const b = await withFreshness('b', async () => [], isEmptyArray);
    expect(b.data).toEqual([]);
    expect(b.freshness).toBe('fresh');
  });
});
