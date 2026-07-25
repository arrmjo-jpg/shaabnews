// Value Objects: على عكس الـ DTOs في entities.ts، هذه تحمل سلوكاً (منطقاً) فعلياً — مستخرَج من
// حسابات كانت تتكرر داخل الـ JSX عبر مكوّنات المباريات (من هو المتصدّر، هل المباراة مباشرة الآن).
import type { MatchKind } from '../games';

export class Score {
  constructor(
    public readonly home: number | null,
    public readonly away: number | null,
  ) {}

  winner(): 'home' | 'away' | 'draw' | null {
    if (this.home === null || this.away === null) return null;
    if (this.home === this.away) return 'draw';
    return this.home > this.away ? 'home' : 'away';
  }
}

export class MatchStatus {
  constructor(
    public readonly kind: MatchKind,
    public readonly minute: string | null,
    public readonly statusText: string | null,
  ) {}

  isLive(): boolean {
    return this.kind === 'live';
  }
}
