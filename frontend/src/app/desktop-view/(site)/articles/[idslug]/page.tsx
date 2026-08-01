// `revalidate` لا يُعاد تصديره: محلّل Next.js البنائي لا يتعرّف على قيمة route segment config مُعاد
// تصديرها من ملف آخر (تحذير بناء فعليّ)، فيسقط للقيمة الافتراضية بصمت. القيمة أدناه رقم حرفي فقط
// (لا منطق) يُطابق '@/app/(site)/articles/[idslug]/page' — تحقّق عند أي تعديل هناك.
export const revalidate = 36000;
export { default, generateStaticParams } from '@/app/(site)/articles/[idslug]/page';
