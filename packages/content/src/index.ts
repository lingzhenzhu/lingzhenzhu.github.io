import { z } from 'zod';
import { safeUrl } from './rich-document';
import { BlockSchema, moduleDefinitions } from './module-contracts';
import { RESOURCE_BYTES, WORKSPACE_BYTES } from './limits';
import { workspaceIssues } from './workspace-structure';
export * from './rich-document';
export * from './module-contracts';

export const localPath = z
  .string()
  .max(500)
  .refine(
    (value) =>
      value.startsWith('/') &&
      value.endsWith('/') &&
      !value.startsWith('//') &&
      !/[\\?#\u0000-\u0020]/.test(value) &&
      !value.split('/').some((part) => part === '..' || part === '.') &&
      !/%(?:2f|5c|2e|00)/i.test(value),
    'Use an absolute, unambiguous site path ending in /',
  )
  .refine((value) => {
    try {
      decodeURI(value);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid URL encoding');

const link = z
  .string()
  .max(2048)
  .refine((value) => safeUrl(value), 'Invalid link');
const imageUrl = z
  .string()
  .max(2048)
  .refine((value) => safeUrl(value, true), 'Invalid image URL');
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const PageSchema = z
  .object({
    id,
    path: localPath,
    title: z.string().min(1).max(300),
    language: z.enum(['en', 'zh-Hans', 'zh-Hant']).default('en'),
    showTitle: z.boolean().default(true),
    indexable: z.boolean().default(true),
    navLabel: z.string().max(60).default(''),
    navOrder: z.number().int().min(0).max(1000).default(0),
    inNavigation: z.boolean().default(false),
    status: z.enum(['draft', 'published']).default('draft'),
    template: z.enum(['page', 'home', 'article']).default('page'),
    description: z.string().max(500).default(''),
    homeHero: z
      .object({
        nameNote: z.string().max(100).default(''),
        image: z
          .discriminatedUnion('source', [
            z.object({ source: z.literal('profile') }),
            z.object({ source: z.literal('custom'), src: imageUrl, alt: z.string().min(1).max(300) }),
          ])
          .optional(),
      })
      .optional(),
    date: z.iso.date().optional(),
    articleDetails: z
      .object({
        time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
        copyright: z.string().max(300).default(''),
        licenseLabel: z.string().max(100).default(''),
        licenseUrl: link.optional(),
      })
      .optional(),
    blocks: z.array(BlockSchema).max(300),
    revision: z.number().int().nonnegative().default(0),
  })
  .superRefine((page, ctx) => {
    for (const block of page.blocks) {
      const requiredPath = moduleDefinitions[block.type].allowedPath;
      if (requiredPath && page.path !== requiredPath)
        ctx.addIssue({
          code: 'custom',
          path: ['path'],
          message: 'The request card must use its protected sign-in address: ' + requiredPath,
        });
    }
    let decoded = page.path;
    try {
      decoded = decodeURI(page.path);
    } catch {}
    if (/^\/(?:admin|api|assets|404\.html|sitemap\.xml|robots\.txt|_release\.json)(?:\/|$)/i.test(decoded))
      ctx.addIssue({ code: 'custom', message: 'This path is reserved', path: ['path'] });
    if (new Set(page.blocks.map((b) => b.id)).size !== page.blocks.length)
      ctx.addIssue({ code: 'custom', message: 'Block IDs must be unique', path: ['blocks'] });
  });
export type Page = z.infer<typeof PageSchema>;
export const NewsSchema = z.object({
  id,
  text: z.string().min(1).max(10000),
  date: z.iso.date(),
  label: z.string().max(100),
  published: z.boolean(),
});
export const MediumSchema = z.object({
  id: z.string().max(500),
  title: z.string().max(500),
  publishedAt: z.iso.datetime(),
  url: z
    .string()
    .url()
    .refine((value) => {
      const u = new URL(value);
      return u.protocol === 'https:' && (u.hostname === 'medium.com' || u.hostname.endsWith('.medium.com'));
    }),
  cover: imageUrl.optional(),
  hidden: z.boolean().default(false),
  coverOverride: imageUrl.optional(),
});
export const SettingsSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().max(100),
  footer: z.string().max(300),
  description: z.string().max(500),
  logo: imageUrl,
  contacts: z
    .array(
      z.object({
        label: z.string().max(100),
        url: link,
        icon: z.enum(['scholar', 'linkedin', 'github', 'twitter', 'instagram', 'wechat', 'link']),
      }),
    )
    .max(20),
});
export const ContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    settings: SettingsSchema,
    pages: z.array(PageSchema).max(2000),
    news: z.array(NewsSchema).max(10000),
    medium: z.array(MediumSchema).max(1000),
  })
  .superRefine((content, ctx) => {
    if (new TextEncoder().encode(JSON.stringify(content)).byteLength > WORKSPACE_BYTES)
      ctx.addIssue({
        code: 'custom',
        message:
          'The workspace exceeds its 8 MB editorial limit. Archive unused drafts before adding more content.',
      });
    for (const [path, resource] of [
      ...content.pages.map((page, index) => [['pages', index], page] as const),
      [['settings'], content.settings],
      [['news'], content.news],
      [['medium'], content.medium],
    ] as [PropertyKey[], unknown][]) {
      if (new TextEncoder().encode(JSON.stringify(resource)).byteLength > RESOURCE_BYTES)
        ctx.addIssue({
          code: 'custom',
          path,
          message: 'This page or shared collection exceeds the 1.8 MB limit. Split it into smaller pages.',
        });
    }
    for (const message of workspaceIssues(content.pages))
      ctx.addIssue({ code: 'custom', message, path: ['pages'] });
  });
export type Content = z.infer<typeof ContentSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type MediumEntry = z.infer<typeof MediumSchema>;
export type NewsEntry = z.infer<typeof NewsSchema>;
/** Feed updates may refresh article metadata, but never undo an editorial visibility/cover choice. */
export function mergeMedium(current: MediumEntry[], incoming: MediumEntry[]) {
  const entries = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    const previous = entries.get(entry.id);
    entries.set(entry.id, {
      ...entry,
      hidden: previous?.hidden ?? false,
      ...(previous?.coverOverride ? { coverOverride: previous.coverOverride } : {}),
    });
  }
  return [...entries.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
export const PUBLIC_ORIGIN = 'https://www.lzzhu.net';

/** The sole allowlist boundary between the editorial database and public builds. */
export function publicSnapshot(input: Content): Content {
  const content = ContentSchema.parse(input);
  return ContentSchema.parse({
    schemaVersion: 1,
    revision: content.revision,
    settings: content.settings,
    pages: content.pages
      .filter((page) => page.status === 'published')
      .map((page) => ({ ...page, revision: 0 })),
    news: content.news.filter((entry) => entry.published),
    medium: content.medium.filter((entry) => !entry.hidden),
  });
}
export function navigation(content: Content) {
  return content.pages
    .filter((p) => p.inNavigation && p.status === 'published')
    .sort((a, b) => a.navOrder - b.navOrder);
}
