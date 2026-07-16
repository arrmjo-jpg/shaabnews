import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/types/users.types';

interface PaginationProps {
  meta: PaginationMeta;
  onPage: (page: number) => void;
}

/** ترقيم احترافي مرن يدعم العربية (RTL) مع أرقام الصفحات والـ Ellipses وعمليات الانتقال السريع. */
export function Pagination({ meta, onPage }: PaginationProps) {
  const { t } = useTranslation('users');
  if (meta.total_pages <= 1) return null;

  const currentPage = meta.current_page;
  const totalPages = meta.total_pages;

  // توليد أرقام الصفحات مع ellipses (...)
  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);

    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
      end = 4;
    } else if (currentPage >= totalPages - 2) {
      start = totalPages - 3;
    }

    if (start > 2) {
      pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push('...');
    }

    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-3 border-t border-border mt-4">
      <p className="text-xs text-muted-foreground">
        {t('pagination.summary', {
          current: currentPage,
          total: totalPages,
          count: meta.total,
        })}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* الصفحة الأولى */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={currentPage <= 1}
          onClick={() => onPage(1)}
        >
          <ChevronsLeft className="h-3.5 w-3.5 rtl:hidden mr-1" />
          <ChevronsRight className="h-3.5 w-3.5 ltr:hidden ml-1" />
          {t('pagination.first')}
        </Button>

        {/* الصفحة السابقة */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={currentPage <= 1}
          onClick={() => onPage(currentPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5 rtl:hidden mr-1" />
          <ChevronRight className="h-3.5 w-3.5 ltr:hidden ml-1" />
          {t('pagination.prev')}
        </Button>

        {/* أرقام الصفحات */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`dots-${idx}`}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground select-none text-xs"
                >
                  ...
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <Button
                key={`page-${p}`}
                variant={isCurrent ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8 p-0 text-xs"
                onClick={() => onPage(p as number)}
              >
                {p}
              </Button>
            );
          })}
        </div>

        {/* الصفحة التالية */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPage(currentPage + 1)}
        >
          {t('pagination.next')}
          <ChevronRight className="h-3.5 w-3.5 rtl:hidden ml-1" />
          <ChevronLeft className="h-3.5 w-3.5 ltr:hidden mr-1" />
        </Button>

        {/* الصفحة الأخيرة */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPage(totalPages)}
        >
          {t('pagination.last')}
          <ChevronsRight className="h-3.5 w-3.5 rtl:hidden ml-1" />
          <ChevronsLeft className="h-3.5 w-3.5 ltr:hidden mr-1" />
        </Button>
      </div>
    </div>
  );
}
