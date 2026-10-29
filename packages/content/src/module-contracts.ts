import { z } from 'zod';
// These primitives remain independent of the module catalog and its UI adapters.
import { richText, safeUrl, emptyDocument } from './rich-document';

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const link = z
  .string()
  .max(2048)
  .refine((value) => safeUrl(value), 'Invalid link');
const imageUrl = z
  .string()
  .max(2048)
  .refine((value) => safeUrl(value, true), 'Invalid image URL');
const base = { id, version: z.literal(1).default(1) };
const uniqueIds = (items: { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;
export const CourseSchema = z.object({
  id,
  year: z.number().int().min(1900).max(2200),
  term: z.enum(['Spring', 'Summer', 'Fall', 'Winter', 'Full year']),
  code: z.string().max(100),
  title: z.string().max(300),
  position: z.string().max(200),
  resourceUrl: link.optional(),
  headingId: id.optional(),
});
export const ResearchPartSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('text'), document: richText }),
  z.object({
    id,
    type: z.literal('image'),
    src: imageUrl,
    alt: z.string().max(1000),
    width: z.number().int().min(16).max(1600).default(500),
  }),
]);
export const GalleryPhotoSchema = z.object({
  id,
  src: imageUrl,
  alt: z.string().max(1000),
  caption: z.string().max(500),
});

/** A module's schema, initial value, catalog entry and sharing semantics live together.
 * No React, browser globals or Worker bindings may be imported by this contract. */
export const moduleDefinitions = {
  teaching: {
    label: 'Teaching institution',
    group: 'Academic',
    icon: 'pages',
    description: 'An institution, its logo and courses.',
    sharedSource: null,
    allowedPath: null,
    schema: z.object({
      ...base,
      type: z.literal('teaching'),
      institution: z.string().max(300),
      logo: imageUrl.optional(),
      showName: z.boolean().default(true),
      courses: z.array(CourseSchema).max(100).refine(uniqueIds, 'Course IDs must be unique'),
    }),
    initial: () => ({ institution: 'New institution', showName: true, courses: [] }),
  },
  research: {
    label: 'Research project',
    group: 'Academic',
    icon: 'pages',
    description: 'Project description, figures and paper link.',
    sharedSource: null,
    allowedPath: null,
    schema: z.object({
      ...base,
      type: z.literal('research'),
      title: z.string().max(300),
      parts: z.array(ResearchPartSchema).max(100).refine(uniqueIds, 'Part IDs must be unique'),
      paperUrl: link.optional(),
      paperLabel: z.string().max(100).default('Read paper'),
    }),
    initial: () => ({ title: 'Untitled project', parts: [], paperLabel: 'Read paper' }),
  },
  gallery: {
    label: 'Photo gallery',
    group: 'Text and images',
    icon: 'image',
    description: 'Photos, captions and slideshow settings.',
    sharedSource: null,
    allowedPath: null,
    schema: z.object({
      ...base,
      type: z.literal('gallery'),
      title: z.string().max(200),
      photos: z.array(GalleryPhotoSchema).max(100).refine(uniqueIds, 'Photo IDs must be unique'),
      autoplay: z.boolean().default(false),
      interval: z.number().int().min(4000).max(60000).default(7000),
    }),
    initial: () => ({ title: 'Selected moments', photos: [], autoplay: false, interval: 7000 }),
  },
  richText: {
    label: 'Text & headings',
    group: 'Text and images',
    icon: 'pages',
    description: 'Rich text or Markdown.',
    sharedSource: null,
    allowedPath: null,
    schema: z.object({ ...base, type: z.literal('richText'), document: richText }),
    initial: () => ({ document: emptyDocument() }),
  },
  image: {
    label: 'Image',
    group: 'Text and images',
    icon: 'image',
    description: 'Image with size and alignment controls.',
    sharedSource: null,
    allowedPath: null,
    schema: z.object({
      ...base,
      type: z.literal('image'),
      src: imageUrl,
      alt: z.string().max(1000),
      width: z.number().int().min(16).max(1600),
      align: z.enum(['left', 'center', 'right']).default('center'),
      rounded: z.boolean().default(true),
    }),
    initial: () => ({ src: '/assets/avatar.jpg', alt: '', width: 500, align: 'center', rounded: true }),
  },
  profile: {
    label: 'Portrait',
    group: 'Text and images',
    icon: 'home',
    description: 'Circular profile photo.',
    sharedSource: null,
    allowedPath: null,
    schema: z.object({ ...base, type: z.literal('profile'), src: imageUrl, alt: z.string().max(300) }),
    initial: () => ({ src: '/assets/avatar.jpg', alt: 'Portrait' }),
  },
  news: {
    label: 'News display',
    group: 'Feeds and links',
    icon: 'pages',
    description: 'News updates.',
    sharedSource: 'news',
    allowedPath: null,
    schema: z.object({
      ...base,
      type: z.literal('news'),
      title: z.string().max(100),
      autoplay: z.boolean().default(true),
      interval: z.number().int().min(4000).max(60000).default(7000),
    }),
    initial: () => ({ title: 'News', autoplay: true, interval: 7000 }),
  },
  contacts: {
    label: 'Contact links',
    group: 'Feeds and links',
    icon: 'globe',
    description: 'Social profiles and contact links.',
    sharedSource: 'contacts',
    allowedPath: null,
    schema: z.object({ ...base, type: z.literal('contacts'), title: z.string().max(100) }),
    initial: () => ({ title: 'How to Reach Me' }),
  },
  medium: {
    label: 'Medium feed',
    group: 'Feeds and links',
    icon: 'globe',
    description: 'Latest articles from Medium.',
    sharedSource: 'medium',
    allowedPath: null,
    schema: z.object({
      ...base,
      type: z.literal('medium'),
      title: z.string().max(100),
      limit: z.number().int().min(1).max(100).default(10),
    }),
    initial: () => ({ title: 'Medium', limit: 10 }),
  },
  archive: {
    label: 'Article list',
    group: 'Feeds and links',
    icon: 'pages',
    description: 'Articles with optional date filters.',
    sharedSource: 'articles',
    allowedPath: null,
    schema: z.object({
      ...base,
      type: z.literal('archive'),
      year: z
        .string()
        .regex(/^\d{4}$/)
        .optional(),
      month: z
        .string()
        .regex(/^(0[1-9]|1[0-2])$/)
        .optional(),
    }),
    initial: () => ({}),
  },
  podcast: {
    label: 'Podcast',
    group: 'Feeds and links',
    icon: 'globe',
    description: 'An Apple Podcasts player.',
    sharedSource: null,
    allowedPath: null,
    schema: z.object({
      ...base,
      type: z.literal('podcast'),
      title: z.string().max(200),
      url: z
        .string()
        .url()
        .refine((value) => {
          const url = new URL(value);
          return url.protocol === 'https:' && url.hostname === 'embed.podcasts.apple.com';
        }),
    }),
    initial: () => ({ title: 'Podcast', url: 'https://embed.podcasts.apple.com/' }),
  },
  rewards: {
    label: 'Request card · Cloudflare',
    group: 'Feeds and links',
    icon: 'cloudflare',
    description: 'A card protected by Cloudflare Access.',
    sharedSource: null,
    allowedPath: '/woaidumuyibeizi/',
    schema: z.object({
      ...base,
      type: z.literal('rewards'),
      title: z.string().max(200),
      issuer: z.string().max(200),
      recipient: z.string().max(200),
      prompt: z.string().max(500),
      submitLabel: z.string().max(100),
    }),
    initial: () => ({
      title: '任意要求卡',
      issuer: '签发人：朱苓榛老公',
      recipient: '授予人：杜沐老婆',
      prompt: '尊敬的老婆大人，请输入你的具体要求：',
      submitLabel: '提交申请',
    }),
  },
  firebaseRewards: {
    label: 'Request card · Firebase',
    group: 'Feeds and links',
    icon: 'firebase',
    description: 'The existing Firebase card. Move or hide this section.',
    sharedSource: null,
    allowedPath: null,
    managedInstance: true,
    schema: z.object({
      id: z.literal('request-application'),
      version: z.literal(1).default(1),
      type: z.literal('firebaseRewards'),
      hidden: z.boolean().default(false),
    }),
    initial: () => ({ hidden: false }),
  },
} as const;
export type BlockType = keyof typeof moduleDefinitions;
const schemas = Object.values(moduleDefinitions).map((definition) => definition.schema);
export const BlockSchema = z.discriminatedUnion(
  'type',
  schemas as [(typeof schemas)[number], ...(typeof schemas)[number][]],
);
export type Block = z.infer<typeof BlockSchema>;
export type ModuleAdapters<Props, Result> = {
  [K in BlockType]: (props: Props & { block: Extract<Block, { type: K }> }) => Result;
};
export function newBlock(type: BlockType): Block {
  const definition = moduleDefinitions[type];
  if (!moduleCapabilities(type).add) throw new Error('This existing section cannot be added or duplicated.');
  return definition.schema.parse({ id: crypto.randomUUID(), version: 1, type, ...definition.initial() });
}

export function moduleCapabilities(type: BlockType) {
  const definition = moduleDefinitions[type];
  const managed = 'managedInstance' in definition && definition.managedInstance;
  return {
    add: !managed,
    copy: !managed && !definition.allowedPath,
    remove: !managed,
    edit: !managed,
    move: !definition.allowedPath,
    hide: managed,
  };
}
