import { moduleDefinitions, type Page } from '@lzzhu/content';
import { Button } from './Button';
import { Icon } from './icons';
import { Switch } from './Switch';
import { blockNames, blockSummary } from './page-model';

/** The outline selects the same block IDs as the editor and live preview. */
export function PageOutline({
  page,
  selected,
  select,
  update,
  settings,
}: {
  page: Page;
  selected: string;
  select: (id: string) => void;
  update: (patch: Partial<Page>) => void;
  settings: () => void;
}) {
  return (
    <aside className="page-outline" aria-label="Page outline">
      <div className="outline-heading">
        <strong>On this page</strong>
        <span>{page.blocks.length}</span>
      </div>
      <nav aria-label="Sections on this page">
        {page.blocks.map((block) => (
          <Button
            variant="quiet"
            compactIcons="keep"
            key={block.id}
            className={selected === block.id ? 'selected' : ''}
            icon={moduleDefinitions[block.type].icon}
            aria-label={'Edit section: ' + blockSummary(block)}
            aria-current={selected === block.id ? 'location' : undefined}
            onClick={() => select(block.id)}
          >
            <span>
              <strong>{blockNames[block.type]}</strong>
              <small>{blockSummary(block)}</small>
            </span>
          </Button>
        ))}
      </nav>
      <section className="outline-visibility" data-glass="clear">
        <Icon name="globe" />
        <h2>Page visibility</h2>
        <label>
          <span>Show in navigation</span>
          <Switch
            checked={page.inNavigation}
            onChange={(event) => update({ inNavigation: event.target.checked })}
          />
        </label>
        <p>
          <Icon name="link" />
          {page.path}
        </p>
      </section>
      <Button icon="settings" onClick={settings}>
        Open page settings
      </Button>
    </aside>
  );
}
