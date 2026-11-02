import { useState } from 'react';
import { newBlock, moduleDefinitions, moduleCapabilities, type Block, type BlockType } from '@lzzhu/content';
import { blockNames } from './page-model';
import { Dialog } from './ui';
import { ChoiceCard, ChoiceGrid } from './ChoiceCard';
const catalog = [...new Set(Object.values(moduleDefinitions).map((definition) => definition.group))].map(
  (group) => ({
    group,
    items: (Object.keys(moduleDefinitions) as BlockType[])
      .filter(
        (type) =>
          moduleDefinitions[type].group === group &&
          moduleCapabilities(type).add &&
          !('variantOf' in moduleDefinitions[type]),
      )
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
              <ChoiceGrid>
                {items.map((item) => (
                  <ChoiceCard
                    key={item.type}
                    icon={item.icon}
                    title={blockNames[item.type]}
                    description={item.description}
                    onClick={() => {
                      onAdd(newBlock(item.type));
                      onClose();
                    }}
                  />
                ))}
              </ChoiceGrid>
            </section>
          )
        );
      })}
    </Dialog>
  );
}
