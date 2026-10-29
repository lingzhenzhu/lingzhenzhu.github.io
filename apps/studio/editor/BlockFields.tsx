import { Suspense, lazy, type ReactNode } from 'react';
import { moduleDefinitions, type Block, type Content, type ModuleAdapters } from '@lzzhu/content';
import { SharedSourceNotice } from './SharedSourceNotice';
import type { RunTask } from './types';
import { ImageField } from './ImageField';
import { TeachingFields } from './TeachingFields';
import { ResearchFields } from './ResearchFields';
import { GalleryFields } from './GalleryFields';
import { Button } from './controls';
const RichEditor = lazy(() => import('./RichEditor').then((module) => ({ default: module.RichEditor })));
type EditorContext = {
  content: Content;
  updateBlock: (id: string, update: Record<string, unknown>) => void;
  run: RunTask;
  upload: (file: File) => Promise<string>;
  setSection: (section: string) => void;
};
type Props = EditorContext & { block: Block };
const imageFields = ({
  block,
  updateBlock,
  run,
  upload,
}: EditorContext & { block: Extract<Block, { type: 'image' | 'profile' }> }) => (
  <ImageField
    src={block.src}
    alt={block.alt}
    run={run}
    upload={upload}
    onChange={(patch) => updateBlock(block.id, patch)}
  />
);

// Exhaustive, browser-only adapters. Adding a contract without an editor is a type error.
export const blockEditors = {
  richText: ({ block, run, upload, updateBlock }) => (
    <Suspense fallback={<p>Loading editor…</p>}>
      <RichEditor
        run={run}
        upload={upload}
        id={block.id}
        document={block.document}
        onChange={(document) => updateBlock(block.id, { document })}
      />
    </Suspense>
  ),
  teaching: ({ block, updateBlock, run, upload }) => (
    <TeachingFields
      block={block}
      update={(patch) => updateBlock(block.id, patch)}
      run={run}
      upload={upload}
    />
  ),
  research: ({ block, updateBlock, run, upload }) => (
    <ResearchFields
      block={block}
      update={(patch) => updateBlock(block.id, patch)}
      run={run}
      upload={upload}
    />
  ),
  gallery: ({ block, updateBlock, run, upload }) => (
    <GalleryFields block={block} update={(patch) => updateBlock(block.id, patch)} run={run} upload={upload} />
  ),
  profile: imageFields,
  image: (props) => (
    <>
      {imageFields(props)}
      <label>
        Display width
        <input
          type="number"
          min="16"
          max="1600"
          value={props.block.width}
          onChange={(e) => props.updateBlock(props.block.id, { width: Number(e.target.value) })}
        />
      </label>
      <label>
        Alignment
        <select
          value={props.block.align}
          onChange={(e) => props.updateBlock(props.block.id, { align: e.target.value })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={props.block.rounded}
          onChange={(e) => props.updateBlock(props.block.id, { rounded: e.target.checked })}
        />
        Rounded corners
      </label>
    </>
  ),
  news: ({ block, updateBlock, setSection }) => (
    <>
      <label className="check">
        <input
          type="checkbox"
          checked={block.autoplay}
          onChange={(e) => updateBlock(block.id, { autoplay: e.target.checked })}
        />
        Automatic rotation
      </label>
      <label>
        Time per item (milliseconds)
        <input
          type="number"
          min="4000"
          max="60000"
          step="1000"
          value={block.interval}
          onChange={(e) => updateBlock(block.id, { interval: Number(e.target.value) })}
        />
      </label>
      <Button icon="news" onClick={() => setSection('news')}>
        Manage news
      </Button>
    </>
  ),
  medium: ({ block, updateBlock, setSection }) => (
    <>
      <label>
        Number of articles
        <input
          type="number"
          min="1"
          max="100"
          value={block.limit}
          onChange={(e) => updateBlock(block.id, { limit: Number(e.target.value) })}
        />
      </label>
      <Button icon="medium" onClick={() => setSection('medium')}>
        Manage Medium articles
      </Button>
    </>
  ),
  archive: ({ block, updateBlock, setSection }) => (
    <>
      <Button icon="articles" onClick={() => setSection('articles')}>
        Manage articles
      </Button>
      <label>
        Year (leave empty for all)
        <input
          value={block.year || ''}
          onChange={(e) => updateBlock(block.id, { year: e.target.value || undefined })}
        />
      </label>
      <label>
        Month
        <input
          value={block.month || ''}
          onChange={(e) => updateBlock(block.id, { month: e.target.value || undefined })}
        />
      </label>
    </>
  ),
  podcast: ({ block, updateBlock }) => (
    <label>
      Apple Podcasts embed URL
      <input value={block.url} onChange={(e) => updateBlock(block.id, { url: e.target.value })} />
    </label>
  ),
  contacts: ({ setSection }) => (
    <Button icon="link" onClick={() => setSection('settings')}>
      Edit contact links
    </Button>
  ),
  rewards: ({ block, updateBlock, setSection }) => (
    <>
      {(['issuer', 'recipient', 'prompt', 'submitLabel'] as const).map((field) => (
        <label key={field}>
          {
            {
              issuer: 'Issuer',
              recipient: 'Recipient',
              prompt: 'Request prompt',
              submitLabel: 'Button label',
            }[field]
          }
          <input value={block[field]} onChange={(e) => updateBlock(block.id, { [field]: e.target.value })} />
        </label>
      ))}
      <Button onClick={() => setSection('rewards')}>Manage requests & balance</Button>
    </>
  ),
  firebaseRewards: ({ block, updateBlock }) => (
    <>
      <p className="field-help">
        This card uses Firebase. Its balance and history are managed on the card page.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={!block.hidden}
          onChange={(event) => updateBlock(block.id, { hidden: !event.target.checked })}
        />
        Show this card
      </label>
    </>
  ),
} satisfies ModuleAdapters<EditorContext, ReactNode>;

export function BlockFields(props: Props) {
  const { block, updateBlock } = props;
  const render = blockEditors[block.type] as (props: Props) => ReactNode;
  return (
    <div className="block-fields" data-module={block.type}>
      {moduleDefinitions[block.type].sharedSource && (
        <SharedSourceNotice
          content={props.content}
          source={moduleDefinitions[block.type].sharedSource!}
          settings
        />
      )}
      {'title' in block && (
        <label>
          Heading
          <input value={block.title} onChange={(e) => updateBlock(block.id, { title: e.target.value })} />
        </label>
      )}
      {render(props)}
    </div>
  );
}
