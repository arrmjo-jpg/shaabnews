import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { STORAGE_KEYS } from '@/lib/constants';
import arCommon from './ar/common.json';
import enCommon from './en/common.json';
import arAuth from './ar/auth.json';
import enAuth from './en/auth.json';
import arSettings from './ar/settings.json';
import enSettings from './en/settings.json';
import arThirdParty from './ar/thirdParty.json';
import enThirdParty from './en/thirdParty.json';
import arCdn from './ar/cdn.json';
import enCdn from './en/cdn.json';
import arUsers from './ar/users.json';
import enUsers from './en/users.json';
import arProfile from './ar/profile.json';
import enProfile from './en/profile.json';
import arSystem from './ar/system.json';
import enSystem from './en/system.json';
import arContent from './ar/content.json';
import enContent from './en/content.json';
import arAi from './ar/ai.json';
import enAi from './en/ai.json';
import arVideoLibrary from './ar/videoLibrary.json';
import enVideoLibrary from './en/videoLibrary.json';
import arBroadcast from './ar/broadcast.json';
import enBroadcast from './en/broadcast.json';
import arWpMigration from './ar/wpMigration.json';
import enWpMigration from './en/wpMigration.json';
import arVertix from './ar/vertix.json';
import enVertix from './en/vertix.json';
import arEpaper from './ar/epaper.json';
import enEpaper from './en/epaper.json';
import arAdvertising from './ar/advertising.json';
import enAdvertising from './en/advertising.json';
import arPolls from './ar/polls.json';
import enPolls from './en/polls.json';
import arTeam from './ar/team.json';
import enTeam from './en/team.json';
import arChat from './ar/chat.json';
import enChat from './en/chat.json';
import arInbox from './ar/inbox.json';
import enInbox from './en/inbox.json';
import arWhatsapp from './ar/whatsapp.json';
import enWhatsapp from './en/whatsapp.json';
import arNotifications from './ar/notifications.json';
import enNotifications from './en/notifications.json';
import arSport from './ar/sport.json';
import enSport from './en/sport.json';

const lang = (localStorage.getItem(STORAGE_KEYS.lang) as 'ar' | 'en') || 'ar';

void i18n.use(initReactI18next).init({
  resources: {
    ar: { common: arCommon, auth: arAuth, settings: arSettings, thirdParty: arThirdParty, cdn: arCdn, users: arUsers, profile: arProfile, system: arSystem, content: arContent, ai: arAi, videoLibrary: arVideoLibrary, broadcast: arBroadcast, wpMigration: arWpMigration, vertix: arVertix, epaper: arEpaper, advertising: arAdvertising, polls: arPolls, team: arTeam, chat: arChat, inbox: arInbox, whatsapp: arWhatsapp, notifications: arNotifications, sport: arSport },
    en: { common: enCommon, auth: enAuth, settings: enSettings, thirdParty: enThirdParty, cdn: enCdn, users: enUsers, profile: enProfile, system: enSystem, content: enContent, ai: enAi, videoLibrary: enVideoLibrary, broadcast: enBroadcast, wpMigration: enWpMigration, vertix: enVertix, epaper: enEpaper, advertising: enAdvertising, polls: enPolls, team: enTeam, chat: enChat, inbox: enInbox, whatsapp: enWhatsapp, notifications: enNotifications, sport: enSport },
  },
  lng: lang,
  fallbackLng: 'ar',
  defaultNS: 'common',
  ns: ['common', 'auth', 'settings', 'thirdParty', 'cdn', 'users', 'profile', 'system', 'content', 'ai', 'videoLibrary', 'broadcast', 'wpMigration', 'vertix', 'epaper', 'advertising', 'polls', 'team', 'chat', 'inbox', 'whatsapp', 'notifications', 'sport'],
  interpolation: { escapeValue: false },
});

export default i18n;
