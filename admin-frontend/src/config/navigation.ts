import {
  LayoutDashboard,
  Settings,
  Plug,
  Cloud,
  SlidersHorizontal,
  Users,
  UsersRound,
  User,
  ShieldCheck,
  Trophy,
  KeyRound,
  Boxes,
  PenLine,
  ScrollText,
  Server,
  CalendarClock,
  Activity,
  ListX,
  Stethoscope,
  Sparkles,
  Newspaper,
  FileText,
  ClipboardCheck,
  FileStack,
  FolderTree,
  Clapperboard,
  LayoutTemplate,
  Images,
  Film,
  Video,
  ListVideo,
  BarChart3,
  Wrench,
  Gauge,
  RadioTower,
  Radio,
  DatabaseZap,
  Megaphone,
  BellRing,
  Target,
  Link2,
  MessageSquare,
  MessageCircle,
  Contact,
  Send,
  Tag,
  Vote,
  type LucideIcon,
} from 'lucide-react';
import { paths } from '@/router/paths';

export interface NavItem {
  key: string; // مفتاح i18n تحت nav.*
  to: string;
  icon: LucideIcon;
  permission?: string; // صلاحية مطلوبة لإظهاره
}

export interface NavSection {
  /** معرّف فريد للمجموعة (للطي/الحفظ) */
  key?: string;
  /** مفتاح i18n لعنوان المجموعة تحت nav.* — وجوده يجعلها dropdown قابلة للطي */
  titleKey?: string;
  /** أيقونة رأس المجموعة */
  icon?: LucideIcon;
  /** يتطلّب تفعيل وحدة الجريدة الرقمية (NewspaperSettings.enabled) لإظهار القسم */
  requiresNewspaper?: boolean;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [{ key: 'dashboard', to: paths.dashboard, icon: LayoutDashboard }],
  },
  {
    key: 'content',
    titleKey: 'content',
    icon: Newspaper,
    items: [
      { key: 'articles', to: paths.articles, icon: FileText, permission: 'articles.view' },
      { key: 'articlesAnalytics', to: paths.articlesAnalytics, icon: BarChart3, permission: 'articles.view' },
      { key: 'reviewQueue', to: paths.reviewQueue, icon: ClipboardCheck, permission: 'articles.view' },
      { key: 'categories', to: paths.categories, icon: FolderTree, permission: 'categories.view' },
      { key: 'tags', to: paths.tags, icon: Tag, permission: 'tags.view' },
      { key: 'comments', to: paths.comments, icon: MessageSquare, permission: 'comments.view' },
      { key: 'pagesList', to: paths.pagesList, icon: FileStack, permission: 'pages.view' },
      { key: 'media', to: paths.media, icon: Images, permission: 'media.view' },
    ],
  },
  {
    key: 'reels',
    titleKey: 'reels',
    icon: Clapperboard,
    items: [
      { key: 'reelsList', to: paths.reels, icon: Clapperboard, permission: 'reels.view' },
      { key: 'reelsAnalytics', to: paths.reelsAnalytics, icon: BarChart3, permission: 'reels.view' },
    ],
  },
  {
    key: 'videoLibrary',
    titleKey: 'videoLibrary',
    icon: Film,
    items: [
      { key: 'vlDashboard', to: paths.vlDashboard, icon: Gauge, permission: 'videos.view' },
      { key: 'vlVideos', to: paths.vlVideos, icon: Video, permission: 'videos.view' },
      { key: 'vlCategories', to: paths.vlCategories, icon: FolderTree, permission: 'video-categories.view' },
      { key: 'vlPlaylists', to: paths.vlPlaylists, icon: ListVideo, permission: 'video-playlists.view' },
      { key: 'vlAnalytics', to: paths.vlAnalytics, icon: BarChart3, permission: 'videos.view' },
      { key: 'vlOperations', to: paths.vlOperations, icon: Wrench, permission: 'videos.view' },
    ],
  },
  {
    key: 'sport',
    titleKey: 'sport',
    icon: Trophy,
    items: [
      { key: 'competitions', to: paths.competitions, icon: Trophy, permission: 'competitions.view' },
      { key: 'sportMenu', to: paths.sportMenu, icon: Trophy, permission: 'sport_menu.view' },
    ],
  },
  {
    key: 'broadcast',
    titleKey: 'broadcast',
    icon: RadioTower,
    items: [
      { key: 'bcDashboard', to: paths.bcDashboard, icon: Gauge, permission: 'broadcasts.view' },
      { key: 'bcBroadcasts', to: paths.bcBroadcasts, icon: Radio, permission: 'broadcasts.view' },
      { key: 'bcCategories', to: paths.bcCategories, icon: FolderTree, permission: 'broadcast-categories.view' },
    ],
  },
  {
    key: 'advertising',
    titleKey: 'advertising',
    icon: Megaphone,
    items: [
      { key: 'adCampaigns', to: paths.adCampaigns, icon: Target, permission: 'ads.view' },
      { key: 'adCreatives', to: paths.adCreatives, icon: Images, permission: 'ads.view' },
      { key: 'adPlacements', to: paths.adPlacements, icon: Link2, permission: 'ads.view' },
      { key: 'adZones', to: paths.adZones, icon: LayoutTemplate, permission: 'ad-zones.view' },
      { key: 'adsAnalytics', to: paths.adsAnalytics, icon: BarChart3, permission: 'ads.view' },
    ],
  },
  {
    key: 'whatsapp',
    titleKey: 'whatsapp',
    icon: MessageCircle,
    items: [
      { key: 'whatsappCampaigns', to: paths.whatsappCampaigns, icon: Send, permission: 'whatsapp.view' },
      { key: 'whatsappGroups', to: paths.whatsappGroups, icon: UsersRound, permission: 'whatsapp.view' },
      { key: 'whatsappContacts', to: paths.whatsappContacts, icon: Contact, permission: 'whatsapp.view' },
    ],
  },
  {
    key: 'polls',
    titleKey: 'polls',
    icon: Vote,
    items: [
      { key: 'pollsList', to: paths.polls, icon: Vote, permission: 'polls.view' },
      { key: 'pollsAnalytics', to: paths.pollsAnalytics, icon: BarChart3, permission: 'polls.view' },
    ],
  },
  {
    key: 'notifications',
    titleKey: 'notifCenter',
    icon: BellRing,
    items: [
      { key: 'notifDashboard', to: paths.notifDashboard, icon: Gauge, permission: 'notifications.view' },
      { key: 'notifCampaigns', to: paths.notifCampaigns, icon: Send, permission: 'notifications.view' },
      { key: 'notifMatrix', to: paths.notifMatrix, icon: LayoutTemplate, permission: 'notifications.view' },
      { key: 'notifTemplates', to: paths.notifTemplates, icon: FileText, permission: 'notifications.view' },
      { key: 'notifHealth', to: paths.notifHealth, icon: Stethoscope, permission: 'notifications.view' },
      { key: 'notifSettings', to: paths.notifSettings, icon: SlidersHorizontal, permission: 'notifications.manage' },
    ],
  },
  {
    key: 'epaper',
    titleKey: 'epaper',
    icon: Newspaper,
    requiresNewspaper: true,
    items: [
      { key: 'epaperIssues', to: paths.epaperIssues, icon: Newspaper, permission: 'epapers.view' },
      { key: 'epaperAnalytics', to: paths.epaperAnalytics, icon: BarChart3, permission: 'epapers.view' },
    ],
  },
  {
    key: 'userManagement',
    titleKey: 'userManagement',
    icon: Users,
    items: [
      { key: 'users', to: paths.users, icon: User, permission: 'users.view' },
      { key: 'teamMembers', to: paths.teamMembers, icon: UsersRound, permission: 'team.view' },
      { key: 'roles', to: paths.roles, icon: ShieldCheck, permission: 'roles.view' },
      { key: 'permissions', to: paths.permissions, icon: KeyRound, permission: 'permissions.view' },
      {
        key: 'permissionGroups',
        to: paths.permissionGroups,
        icon: Boxes,
        permission: 'permission-groups.view',
      },
      {
        key: 'writerRequests',
        to: paths.writerRequests,
        icon: PenLine,
        permission: 'writer-requests.view',
      },
      {
        key: 'activityLog',
        to: paths.activityLog,
        icon: ScrollText,
        permission: 'activity.view',
      },
    ],
  },
  {
    key: 'systemSettings',
    titleKey: 'systemSettings',
    icon: SlidersHorizontal,
    items: [
      { key: 'settings', to: paths.settings, icon: Settings, permission: 'settings.view' },
      { key: 'thirdParty', to: paths.thirdParty, icon: Plug, permission: 'settings.view' },
      { key: 'cdn', to: paths.cdn, icon: Cloud, permission: 'cdn.view' },
    ],
  },
  {
    key: 'systemOperations',
    titleKey: 'systemOperations',
    icon: Server,
    items: [
      {
        key: 'opsOverview',
        to: paths.opsOverview,
        icon: Activity,
        permission: 'scheduler.view',
      },
      {
        key: 'scheduler',
        to: paths.scheduler,
        icon: CalendarClock,
        permission: 'scheduler.view',
      },
      {
        key: 'failedJobs',
        to: paths.failedJobs,
        icon: ListX,
        permission: 'failed_jobs.view',
      },
      {
        key: 'diagnostics',
        to: paths.diagnostics,
        icon: Stethoscope,
        permission: 'scheduler.view',
      },
      {
        key: 'aiUsage',
        to: paths.aiUsage,
        icon: Sparkles,
        permission: 'ai.settings',
      },
      {
        key: 'wpMigration',
        to: paths.wpMigration,
        icon: DatabaseZap,
        permission: 'wp-migration.view',
      },
      {
        key: 'vertixMigration',
        to: paths.vertixMigration,
        icon: DatabaseZap,
        permission: 'vertix-migration.view',
      },
    ],
  },
];

/** قائمة مسطّحة للاستخدامات التي تحتاج كل العناصر (مثل Breadcrumbs) */
export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);
