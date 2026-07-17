import { getComments } from '@/lib/comments';

import { CommentForm } from './comment-form';
import { CommentList } from './comment-list';

// قسم التعليقات (Server) — يُعرَض **فقط** عند `enabled` = SSoT `commentsEnabled` (CommentGuard: عالميّ ∧ مقال).
// يجلب القائمة المعتمَدة فقط هنا (SEO محفوظ لمحتوى التعليقات). حالة تسجيل الدخول لم تعد تُحسَم هنا
// (كانت getCurrentUser هنا تُسقِط صفحة المقال بالكامل من ISR — راجع ISR Restoration) — CommentForm
// (عميل أصلاً) يحسمها بنفسه عبر useAuthSession بعد mount.
export async function CommentSection({ slug, enabled }: { slug: string; enabled: boolean }) {
  if (!enabled) return null;

  const comments = await getComments(slug);

  return (
    <section aria-labelledby="comments-heading" className="mt-8 border-t border-border pt-6">
      <h2 id="comments-heading" className="mb-4 text-lg font-extrabold text-fg">
        التعليقات{comments.length > 0 && <span className="ms-1 font-bold text-muted">({comments.length})</span>}
      </h2>
      <CommentList comments={comments} />
      <div className="mt-6">
        <CommentForm slug={slug} />
      </div>
    </section>
  );
}
