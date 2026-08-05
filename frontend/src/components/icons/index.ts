// ── Central icon layer · single source of truth ────────────────────────────
// EVERY icon in the app MUST be imported from "@/components/icons".
// System/UI icons → lucide-react (here only). Social/brand icons → inline SVG.
// Adding an icon = add a named re-export here (never import lucide elsewhere).

// Official size scale in px. No arbitrary sizes (e.g. 17/19/21/27) anywhere.
export const IconSize = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 } as const;
export type IconSizeToken = keyof typeof IconSize;

// System UI icons — lucide-react, Icon-suffixed, named re-exports (tree-shakeable).
export {
  Search as SearchIcon,
  UserRound as UserIcon,
  Menu as MenuIcon,
  X as CloseIcon,
  ChevronDown as ChevronDownIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Play as PlayIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Rss as RssIcon,
  // Dashboard
  LayoutDashboard as DashboardIcon,
  FileText as FileTextIcon,
  Video as VideoIcon,
  Film as FilmIcon,
  Bell as BellIcon,
  Bookmark as BookmarkIcon,
  Heart as HeartIcon,
  LayoutGrid as GridIcon,
  LogOut as LogOutIcon,
  Plus as PlusIcon,
  Inbox as InboxIcon,
  Calendar as CalendarIcon,
  MessageSquare as MessageSquareIcon,
  ImagePlus as ImagePlusIcon,
  Tag as TagIcon,
  // Rich text editor toolbar
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Heading2 as Heading2Icon,
  Heading3 as Heading3Icon,
  List as ListIcon,
  ListOrdered as ListOrderedIcon,
  Quote as QuoteIcon,
  Link2 as LinkIcon,
  Undo2 as UndoIcon,
  Redo2 as RedoIcon,
  AlignRight as AlignRightIcon,
  AlignCenter as AlignCenterIcon,
  AlignLeft as AlignLeftIcon,
  AlignJustify as AlignJustifyIcon,
} from 'lucide-react';

// Social / brand icons — inline SVG (currentColor; brand marks keep their own colors).
export {
  FacebookIcon,
  GoogleIcon,
  XIcon,
  InstagramIcon,
  YoutubeIcon,
  WhatsappIcon,
  TelegramIcon,
  LinkedinIcon,
  TikTokIcon,
  WebsiteIcon,
  type SocialIconProps,
} from './social';
