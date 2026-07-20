import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, Palette, Mail, Share2, BarChart3, HardDrive, Newspaper, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { paths } from '@/router/paths';

const items = [
  { key: 'general', to: paths.settingsGeneral, icon: SlidersHorizontal },
  { key: 'branding', to: paths.settingsBranding, icon: Palette },
  { key: 'email', to: paths.settingsEmail, icon: Mail },
  { key: 'social', to: paths.settingsSocial, icon: Share2 },
  { key: 'analytics', to: paths.settingsAnalytics, icon: BarChart3 },
  { key: 'mediaStorage', to: paths.settingsMediaStorage, icon: HardDrive },
  { key: 'newspaper', to: paths.settingsNewspaper, icon: Newspaper },
  { key: 'matchBar', to: paths.settingsMatchBar, icon: Trophy },
  { key: 'sport', to: paths.settingsSport, icon: Trophy },
];

export function SettingsNav() {
  const { t } = useTranslation('settings');
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-background p-2 lg:flex-col lg:overflow-visible">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <NavLink
            key={it.key}
            to={it.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <Icon className="h-4.5 w-4.5" />
            {t(`nav.${it.key}`)}
          </NavLink>
        );
      })}
    </nav>
  );
}
