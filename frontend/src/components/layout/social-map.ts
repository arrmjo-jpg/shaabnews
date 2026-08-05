import type { ComponentType } from 'react';

import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TikTokIcon,
  WebsiteIcon,
  WhatsappIcon,
  XIcon,
  YoutubeIcon,
  type SocialIconProps,
} from '@/components/icons';

// خريطة مفاتيح التواصل (من إعدادات الموقع `social` أو TeamMember::SOCIAL_KEYS) → أيقونة العلامة +
// تسمية وصوليّة. مصدر واحد يتشاركه الفوتر ولوحة «بيانات التواصل» (اتصل بنا/أعلن معنا) وصفحات فريق
// العمل — لا منطق مكرَّر. tiktok/linkedin/website/twitter_x أُضيفت خصّيصًا لتغطية
// TeamMember::SOCIAL_KEYS بالكامل (كانت مفاتيحها الإضافية تُسقَط بصمت قبل هذا التوسيع).
export interface SocialEntry {
  key: string;
  url: string;
  Icon: ComponentType<SocialIconProps>;
  label: string;
}

const SOCIAL: Record<string, { Icon: ComponentType<SocialIconProps>; label: string }> = {
  facebook: { Icon: FacebookIcon, label: 'فيسبوك' },
  x: { Icon: XIcon, label: 'إكس' },
  twitter: { Icon: XIcon, label: 'إكس' },
  twitter_x: { Icon: XIcon, label: 'إكس' },
  instagram: { Icon: InstagramIcon, label: 'إنستغرام' },
  youtube: { Icon: YoutubeIcon, label: 'يوتيوب' },
  whatsapp: { Icon: WhatsappIcon, label: 'واتساب' },
  tiktok: { Icon: TikTokIcon, label: 'تيك توك' },
  linkedin: { Icon: LinkedinIcon, label: 'لينكدإن' },
  website: { Icon: WebsiteIcon, label: 'الموقع الإلكتروني' },
};

const isHttpUrl = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//i.test(v);

/** صفوف تواصل جاهزة للعرض — مفاتيح معروفة بروابط http فقط (غيرها يُهمل بصمت). */
export function socialEntries(social: Record<string, string> | null | undefined): SocialEntry[] {
  return Object.entries(social ?? {})
    .filter(([key, url]) => SOCIAL[key] && isHttpUrl(url))
    .map(([key, url]) => ({ key, url, Icon: SOCIAL[key].Icon, label: SOCIAL[key].label }));
}
