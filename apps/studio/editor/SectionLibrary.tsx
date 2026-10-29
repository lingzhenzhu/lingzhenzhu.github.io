import { Button } from './controls';
import { useState } from 'react';
import { newBlock, moduleDefinitions, moduleCapabilities, type Block, type BlockType } from '@lzzhu/content';
import { blockNames } from './page-model';
import { Dialog, Icon } from './ui';
const catalog = [...new Set(Object.values(moduleDefinitions).map((definition) => definition.group))].map(
  (group) => ({
    group,
    items: (Object.keys(moduleDefinitions) as BlockType[])
      .filter((type) => moduleDefinitions[type].group === group && moduleCapabilities(type).add)
      .map((type) => ({ type, ...moduleDefinitions[type] })),
  }),
);
export function SectionLibrary({
  path,
  onAdd,
  onClose,
  returnFocusTo,
}: {
  path: string;
  onAdd: (block: Block) => void;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const [query, search] = useState('');
  return (
    <Dialog title="Add a section" onClose={onClose} returnFocusTo={returnFocusTo}>
      <label>
        Find a section
        <input data-dialog-focus type="search" value={query} onChange={(e) => search(e.target.value)} />
      </label>
      {catalog.map((group) => {
        const items = group.items.filter(
          (item) =>
            (!item.allowedPath || path === item.allowedPath) &&
            (blockNames[item.type] + ' ' + item.description).toLowerCase().includes(query.toLowerCase()),
        );
        return (
          !!items.length && (
            <section key={group.group} className="section-library">
              <h3>{group.group}</h3>
              <div className="section-library-grid">
                {items.map((item) => (
                  <Button
                    compactIcons="keep"
                    key={item.type}
                    onClick={() => {
                      onAdd(newBlock(item.type));
                      onClose();
                    }}
                  >
                    <Icon name={item.icon} />
                    <span>
                      <strong>{blockNames[item.type]}</strong>
                      <small>{item.description}</small>
                    </span>
                  </Button>
                ))}
              </div>
            </section>
          )
        );
      })}
    </Dialog>
  );
}
