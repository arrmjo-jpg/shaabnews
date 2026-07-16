import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityContentType, EntitySuggestion, EntityType } from '@/services/entities.service';
import {
  useContentEntities,
  useCreateEntity,
  useEntitySuggestions,
  useSyncContentEntities,
} from '../hooks';

interface Props {
  contentType: EntityContentType;
  contentId: number | undefined;
}

const ENTITY_TYPES: EntityType[] = ['person', 'organization', 'place', 'topic'];

/**
 * Self-contained (not a react-hook-form field): entity tagging has its own
 * persistence lifecycle (PATCH .../entities), separate from the surrounding
 * article/video/reel form's own save — mirrors how the backend API is shaped
 * (sync requires an existing content id; a brand-new unsaved item has none).
 */
export function EntityTagsInput({ contentType, contentId }: Props) {
  const { t } = useTranslation('content');
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const current = useContentEntities(contentType, contentId);
  const suggestions = useEntitySuggestions(input);
  const createEntity = useCreateEntity();
  const sync = useSyncContentEntities(contentType, contentId);

  const value = current.data ?? [];
  const items = (suggestions.data ?? []).filter(
    (s) => !value.some((v) => v.id === s.id) && s.name.toLowerCase() !== input.trim().toLowerCase(),
  );

  useEffect(() => {
    setHighlight(0);
  }, [input, items.length]);

  const commitExisting = (entity: EntitySuggestion) => {
    const next = [...value, entity];
    sync.mutate(next.map((e) => e.id));
    setInput('');
  };

  const commitNew = (type: EntityType) => {
    const name = input.trim();
    if (name === '') return;
    createEntity.mutate(
      { type, name },
      {
        onSuccess: (entity) => {
          const next = [...value, entity];
          sync.mutate(next.map((e) => e.id));
          setInput('');
        },
      },
    );
  };

  const removeAt = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    sync.mutate(next.map((e) => e.id));
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && items.length > 0 && focused) {
      e.preventDefault();
      const picked = items[highlight];
      if (picked) commitExisting(picked);
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      removeAt(value.length - 1);
    } else if (e.key === 'ArrowDown' && items.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.min(items.length - 1, h + 1));
    } else if (e.key === 'ArrowUp' && items.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Escape') {
      setInput('');
    }
  };

  if (contentId === undefined) {
    return (
      <p className="border border-dashed border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t('entities.saveFirst')}
      </p>
    );
  }

  const open = focused && input.trim().length > 0;

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'flex flex-wrap gap-1.5 border border-input bg-background p-2 transition-colors',
          focused && 'ring-2 ring-ring',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((entity, idx) => (
          <span
            key={entity.id}
            className="inline-flex items-center gap-1 border border-border bg-muted/50 px-2 py-0.5 text-xs"
          >
            <span className="text-muted-foreground">{t(`entities.type.${entity.type}`)}</span>
            <span>{entity.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(idx);
              }}
              aria-label={t('entities.remove')}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={t('entities.placeholder')}
          className="min-w-[160px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <p className="text-xs text-muted-foreground">{t('entities.help')}</p>

      {open ? (
        <div className="border border-border bg-background shadow-soft">
          {suggestions.isLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t('entities.searching')}</p>
          ) : (
            <>
              {items.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => commitExisting(s)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors',
                    i === highlight ? 'bg-accent' : 'hover:bg-accent/60',
                  )}
                >
                  <span className="text-xs text-muted-foreground">
                    {t(`entities.type.${s.type}`)}
                  </span>
                  <span>{s.name}</span>
                </button>
              ))}
              <div className="flex flex-wrap gap-1.5 border-t border-border p-2">
                <span className="w-full text-xs text-muted-foreground">
                  {t('entities.createAs', { name: input.trim() })}
                </span>
                {ENTITY_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => commitNew(type)}
                    disabled={createEntity.isPending}
                    className="border border-dashed border-input bg-background px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    + {t(`entities.type.${type}`)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
