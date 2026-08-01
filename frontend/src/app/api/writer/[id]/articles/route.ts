import { NextResponse } from 'next/server';

import { getWriterArticles } from '@/lib/writer';

const PER_PAGE = 18;

// BFF: صفحة تالية لتغذية مقالات الكاتب (زرّ "تحميل المزيد") — نفس نمط
// /api/category/[slug]/route.ts، عبر getWriterArticles (نفس جالب الصفحة، لا مسار بيانات موازٍ).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ items: [], total: 0, page, totalPages: 0 }, { status: 400 });
  }

  const result = await getWriterArticles(numericId, page, PER_PAGE);

  return NextResponse.json(result);
}
