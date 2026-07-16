export interface DisplayFlag {
  key: 'is_pinned' | 'is_breaking' | 'is_featured' | 'is_header' | 'is_editor_pick' | 'is_squares';
  labelKey: string;
  variant: 'default' | 'success' | 'muted' | 'destructive';
}

export const DISPLAY_FLAGS: DisplayFlag[] = [
  { key: 'is_pinned', labelKey: 'articles.form.isPinned', variant: 'muted' },
  { key: 'is_breaking', labelKey: 'articles.form.isBreaking', variant: 'destructive' },
  { key: 'is_featured', labelKey: 'articles.form.isFeatured', variant: 'default' },
  { key: 'is_header', labelKey: 'articles.form.isHeader', variant: 'default' },
  { key: 'is_editor_pick', labelKey: 'articles.form.isEditorPick', variant: 'success' },
  { key: 'is_squares', labelKey: 'articles.form.isSquares', variant: 'default' },
];
