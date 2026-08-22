import { AdZone } from '@/components/ads/ad-zone';

import { SidebarNewsWidget } from './sidebar-news-widget';

// الشريط الجانبيّ المشترك لصفحات القراءة (المقال + الصفحات الثابتة + الأقسام): إعلانان حيّان
// (AdZone — client island، no-store) يحيطان بودجت الأخبار، واحد فوقها وواحد تحتها. لا إعلان ⇒
// AdZone يعيد null فلا يُنشَأ عنصر فارغ ولا يتأثّر التخطيط. مصدر واحد للجانب (DRY) بدل تكراره
// في كلّ صفحة — لذلك يظهر الإعلانان بكلّ صفحات القراءة معًا (أقسام/أخبار/كاتب/ثابتة/فريق)،
// وهو ما تعنيه تسمية المساحتين («في الأقسام والأخبار»).
export function ReadingSidebar() {
  return (
    <div className="space-y-6">
      <AdZone zone="aalan_ala_shmal_alaqsam_w_alakhbar_fy_alaala" />
      <SidebarNewsWidget />
      <AdZone zone="aalan_asfl_alwdjt_fy_alaqsa_walakhbar" />
    </div>
  );
}
