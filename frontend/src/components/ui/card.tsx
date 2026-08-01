import type { ComponentPropsWithoutRef, ElementType } from 'react';

import { cn } from '@/lib/utils';

// غلاف البطاقة الموحَّد لقسم الرياضة — بديل مشترك لنمط "border border-border bg-surface" المكرَّر
// حرفيًّا في أكثر من ٣٠ ملفًا (طلب صريح: "create shared reusable Card wrappers instead of
// duplicating styles"). .sport-card تمنح زوايا مدوّرة حقيقية (استثناء مُوافَق عليه من "Square
// design" العامّ، محصور بقسم الرياضة — راجع globals.css). shadow-sm + overflow-hidden يجعل أي
// CardHeader/CardFooter داخلي يُقصّ تلقائيًّا مطابقًا لانحناء البطاقة الخارجيّة، بلا حاجة لتدوير
// زوايا كل جزء داخليّ يدويًّا. Polymorphic (`as`) لأنّ الاستخدامات الحالية تتنوّع بين
// section/div/article حسب الدلالة الصحيحة لكل سياق.
type CardProps<T extends ElementType> = { as?: T } & ComponentPropsWithoutRef<T>;

export function Card<T extends ElementType = 'div'>({ as, className, ...props }: CardProps<T>) {
  const Comp = (as ?? 'div') as ElementType;
  return <Comp className={cn('sport-card overflow-hidden border border-border bg-surface shadow-sm', className)} {...props} />;
}

export function CardHeader<T extends ElementType = 'div'>({ as, className, ...props }: CardProps<T>) {
  const Comp = (as ?? 'div') as ElementType;
  return <Comp className={cn('flex items-center gap-2 border-b border-border px-4 py-3', className)} {...props} />;
}

export function CardFooter<T extends ElementType = 'div'>({ as, className, ...props }: CardProps<T>) {
  const Comp = (as ?? 'div') as ElementType;
  return <Comp className={cn('border-t border-border px-4 py-3', className)} {...props} />;
}
