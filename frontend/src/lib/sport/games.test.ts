import { describe, expect, it, vi } from 'vitest';
import brokenPayload from './__fixtures__/game-4747697-member-missing-id.json';
import workingPayload from './__fixtures__/game-4773214-working.json';
import { getGameDetail } from './games';

// مباراة 4747697 (هولندا × المغرب، دور الـ٣٢، ركلات ترجيح) — 365Scores أعاد سجلّين لنفس
// اللاعب (تيون كوبمينيرز، athleteId=50647) داخل `members[]`: واحد كامل (index 12، id=3725457)
// وآخر ناقص بلا `id` إطلاقًا (index 54). قبل التطبيع: GameResponse.safeParse يفشل بالكامل على
// المصفوفة بسبب السجلّ الناقص وحده، فتُعامَل المباراة كمعطومة (404) رغم أن بقيّة الاستجابة —
// بما فيها السجلّ الكامل لنفس اللاعب — صحيحة تمامًا. راجع التحقيق الجنائيّ لمباراة 4747697 في
// سجلّ المحادثة لتفاصيل الإثبات.

function mockFetchOnce(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })),
  );
}

describe('getGameDetail — تحمّل فجوة بيانات المزوّد (عضو بلا id)', () => {
  it('لا يفشل بسبب عضو واحد بلا id — يُرجع تفاصيل المباراة كاملة (مباراة 4747697)', async () => {
    mockFetchOnce(brokenPayload);
    const detail = await getGameDetail(4747697);

    expect(detail).not.toBeNull();
    expect(detail?.id).toBe(4747697);
    expect(detail?.home.name).toBe('هولندا');
    expect(detail?.away.name).toBe('المغرب');
    // التشكيلة تُبنى رغم السجلّ الناقص (يُتجاوَز هو وحده، لا التشكيلة كاملة).
    expect(detail?.homeLineup?.starters.length).toBeGreaterThan(0);
    // اللاعب صاحب السجلّ الناقص (كوبمينيرز، athleteId=50647) لا يزال يظهر بشكل صحيح في تشكيلة
    // هولندا — لأنّ له سجلًّا آخر كاملًا (id=3725457) في نفس المصفوفة يُستخدَم بدلًا منه؛ التطبيع لم
    // يُفقِد هذا اللاعب، بل تجاوَز فقط النسخة المكرّرة الناقصة منه.
    const allHomePlayers = [...(detail?.homeLineup?.starters ?? []), ...(detail?.homeLineup?.bench ?? [])];
    const koopmeiners = allHomePlayers.find((p) => p.id === 50647);
    expect(koopmeiners).toBeDefined();
    expect(koopmeiners?.name).toContain('كووبميينيرز');
  });

  it('لا يزال يُطبِّع athleteId كهويّة اللاعب الظاهرة لبقيّة أعضاء التشكيلة العاديّين', async () => {
    mockFetchOnce(brokenPayload);
    const detail = await getGameDetail(4747697);
    const anyStarter = detail?.homeLineup?.starters[0];
    expect(anyStarter?.id).toBeTypeOf('number');
    // athleteId (وليس id المحليّ الكبير) هو ما يُفترض ظهوره — قيمه أصغر بكثير من الفضاء المحليّ.
    expect(anyStarter!.id).toBeLessThan(1_000_000);
  });

  it('مباراة سليمة (4773214) تستمرّ بالعمل دون أيّ تغيير في السلوك', async () => {
    mockFetchOnce(workingPayload);
    const detail = await getGameDetail(4773214);

    expect(detail).not.toBeNull();
    expect(detail?.id).toBe(4773214);
    expect(detail?.homeLineup?.starters.length).toBeGreaterThan(0);
    expect(detail?.awayLineup?.starters.length).toBeGreaterThan(0);
  });

  it('استجابة غير ناجحة (404 من 365) لا تزال تُرجع null كما كانت دائمًا', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const detail = await getGameDetail(999999999);
    expect(detail).toBeNull();
  });
});
