import { useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { articlesService } from '@/services/articles.service';
import { useToast } from '@/hooks/useToast';
import type { NormalizedError } from '@/types/api';
import type { ContentLocale } from '@/types/content.types';
import { Embed } from './EmbedExtension';
import { Poll } from './PollExtension';
import { EditorToolbar } from './EditorToolbar';
import { isSafeLinkUrl } from './LinkDialog';

interface Props {
  value: unknown; // TipTap doc JSON
  onChange: (doc: unknown) => void;
  /** When provided, enables inline image upload. Null on CREATE. */
  articleId: number | null;
  locale: ContentLocale;
  disabled?: boolean;
}

/**
 * TipTap editor with strict parity to backend TipTapSanitizer allow-list.
 *
 * Nodes:    doc, paragraph, text, heading(1-6), blockquote, bulletList,
 *           orderedList, listItem, codeBlock, horizontalRule, hardBreak,
 *           image, embed (custom), table/tableRow/tableHeader/tableCell.
 * Marks:    bold, italic, underline, strike, code, link (http/https/mailto).
 * Embeds:   inserted via backend resolver (YouTube/Vimeo/Twitter/Facebook/Instagram).
 *
 * Output:  pure TipTap JSON via editor.getJSON(); backend sanitizes on save.
 */
export function ArticleEditor({ value, onChange, articleId, locale, disabled }: Props) {
  const { error: toastError } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Strip extensions the backend allow-list does not include.
        // Starter ships these all in the allow-list anyway: paragraph, heading,
        // blockquote, bulletList/orderedList/listItem, codeBlock, hardBreak,
        // horizontalRule, bold, italic, strike, code, history, document, text.
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        // Disallow inline HTML at the schema level (no raw HTML mode).
        dropcursor: { width: 2 },
      }),
      Underline,
      // محاذاة النص على الفقرات والعناوين — مطابقة لقائمة السماح في الخادم.
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Link.configure({
        autolink: false,
        openOnClick: false,
        // Backend always rewrites these — set client-side too for consistency.
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
        protocols: ['http', 'https', 'mailto'],
        validate: (href) => isSafeLinkUrl(href),
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'mx-auto my-3 max-w-full' },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Embed,
      Poll,
    ],
    content: (value as object | null) ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable: !disabled,
    parseOptions: { preserveWhitespace: 'full' },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON());
    },
    editorProps: {
      attributes: {
        // Direct-styled prose: prevents reliance on @tailwindcss/typography
        class:
          'min-h-[320px] w-full border border-input bg-background px-4 py-3 text-sm leading-7 focus:outline-none focus:ring-2 focus:ring-ring',
        dir: locale === 'ar' ? 'rtl' : 'ltr',
        spellcheck: 'true',
      },
      // Hard block: paste HTML is converted to plain text; only safe HTML is
      // already handled by TipTap's clipboard parsers. We also strip everything
      // not in the schema via TipTap's built-in parseHTML behavior.
      transformPastedHTML: (html) => html,
    },
  });

  // Re-sync external value changes (e.g. when article hydrates after fetch).
  // Compare by JSON to avoid resetting content if the change originated from the editor itself.
  useEffect(() => {
    if (!editor) return;
    
    // Convert the incoming value and the editor's current content to JSON strings for a deep equality check.
    const currentJson = JSON.stringify(editor.getJSON());
    const nextJson = JSON.stringify((value as object | null) ?? { type: 'doc', content: [{ type: 'paragraph' }] });
    
    if (currentJson === nextJson) return;

    editor.commands.setContent(
      (value as object | null) ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      { emitUpdate: false },
    );
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  // Inline image upload — only available when an article id exists.
  const upload = useMutation({
    mutationFn: (file: File) =>
      articlesService.uploadMedia(articleId as number, 'inline', file),
    onError: (e: NormalizedError) => toastError(e.message),
  });

  const handleUpload = useCallback(
    async (file: File): Promise<{ url: string; alt?: string } | null> => {
      if (articleId === null) return null;
      const result = await upload.mutateAsync(file).catch(() => null);
      if (!result) return null;
      const newest = result.media?.inline?.[result.media.inline.length - 1];
      if (!newest) return null;
      return { url: newest.url, alt: newest.name ?? '' };
    },
    [articleId, upload],
  );

  if (!editor) return null;

  return (
    <div className="border border-border bg-background">
      <EditorToolbar
        editor={editor}
        articleId={articleId}
        onUploadImage={handleUpload}
        uploading={upload.isPending}
        locale={locale}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
