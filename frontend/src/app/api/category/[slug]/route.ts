import { NextResponse } from 'next/server';

import { getCategoryPage } from '@/lib/feed';

const PER_PAGE = 18;

// BFF: صفحة تالية لتغذية القسم الزمنية (زرّ "تحميل المزيد") — offset حقيقي عبر
// getCategoryPage (نفس جالب /category/[slug]/page.tsx، لا استعلام جديد ولا مسار بيانات مواز).
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const result = await getCategoryPage(decodeURIComponent(slug), page, PER_PAGE);

  return NextResponse.json(result);
}
