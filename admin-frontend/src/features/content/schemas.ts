import { z } from 'zod';

const SLUG_RE = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export const articleFormSchema = z
  .object({
    title: z.string().trim().min(2, 'content:articles.validation.titleMin').max(200, 'content:articles.validation.titleMax'),
    subtitle: z.string().trim().max(250, 'content:articles.validation.subtitleMax').optional().or(z.literal('')),
    locale: z.enum(['ar', 'en']),
    type: z.enum(['news', 'opinion', 'live']),
    slug: z
      .string()
      .trim()
      .max(190, 'content:articles.validation.slugMax')
      .regex(SLUG_RE, 'content:articles.validation.slug')
      .optional()
      .or(z.literal('')),
    // Optional — auto-filled from the first two body lines in the UI, never forced.
    excerpt: z
      .string()
      .trim()
      .max(2000, 'content:articles.validation.excerptMax')
      .optional()
      .or(z.literal('')),
    /** TipTap doc JSON — schema-level allow-list enforcement is server-side. */
    content_json: z.unknown(),

    // Unified categories: at least one (stored as primary), any number of extras.
    primary_category_id: z.number().int().positive('content:articles.validation.primaryRequired'),
    secondary_category_ids: z.array(z.number().int().positive()),

    // Required when type=opinion and the actor is editorial; otherwise nullable.
    author_id: z.number().int().positive().nullable(),

    tags: z.array(z.string().trim().min(1).max(50)).max(30, 'content:articles.validation.tagsMax'),

    seo_title: z.string().trim().max(255).optional().or(z.literal('')),
    seo_description: z.string().trim().max(1000).optional().or(z.literal('')),
    seo_keywords: z.string().trim().max(255).optional().or(z.literal('')),
    canonical_url: z.string().trim().max(255).optional().or(z.literal('')),
    robots: z.string().trim().max(50).optional().or(z.literal('')),

    is_featured: z.boolean(),
    is_breaking: z.boolean(),
    is_pinned: z.boolean(),
    is_header: z.boolean(),
    is_editor_pick: z.boolean(),
    is_squares: z.boolean(),
    comments_enabled: z.boolean(),
    views_count: z.coerce.number().int().min(0),
  })
  .superRefine((d, ctx) => {
    // Defensive only — the unified picker keeps the set disjoint by construction.
    if (d.secondary_category_ids.includes(d.primary_category_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['secondary_category_ids'],
        message: 'content:articles.validation.primaryInSecondary',
      });
    }
  });

export type ArticleFormValues = z.infer<typeof articleFormSchema>;
