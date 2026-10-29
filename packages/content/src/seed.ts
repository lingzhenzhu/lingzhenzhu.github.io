import { ContentSchema, type Content } from './index';
import { resources, parseResource } from './resources';
/** Seeding is only for an empty database; it never replaces an existing draft. */
export function seedSql(value: Content) {
  const content = ContentSchema.parse(value);
  const quote = (text: string) => "'" + text.replaceAll("'", "''") + "'";
  const revision = content.revision;
  const importId = quote('import-' + crypto.randomUUID());
  const owned = `(SELECT mutation_id FROM workspace WHERE id=1)=${importId}`;
  const statements = [
    `INSERT OR IGNORE INTO workspace VALUES(1,${revision},datetime('now'),'initial-import',${importId});`,
  ];
  for (const [key, value] of resources(content)) {
    const json = JSON.stringify(parseResource(key, value)),
      resourceKey = quote(key);
    const unfinished = `${owned} AND NOT EXISTS(SELECT 1 FROM resource_versions WHERE key=${resourceKey})`;
    // D1 limits SQL text to 100 KB. Assemble long documents from bounded UTF-8-safe
    // statements, then seal each resource in history. Replaying this file resumes
    // unfinished resources; a different import cannot modify an existing workspace.
    statements.push(
      `INSERT OR IGNORE INTO content_resources SELECT ${resourceKey},${revision},NULL WHERE ${owned};`,
      `UPDATE content_resources SET document='' WHERE key=${resourceKey} AND ${unfinished};`,
    );
    for (let start = 0; start < json.length;) {
      let end = Math.min(start + 16000, json.length);
      if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end--;
      statements.push(
        `UPDATE content_resources SET document=document||${quote(json.slice(start, end))} WHERE key=${resourceKey} AND ${unfinished};`,
      );
      start = end;
    }
    statements.push(
      `INSERT OR IGNORE INTO resource_versions SELECT key,revision,document FROM content_resources WHERE key=${resourceKey} AND ${owned};`,
    );
  }
  statements.push(
    `INSERT OR IGNORE INTO revisions SELECT ${revision},datetime('now'),'initial-import',${importId},'' WHERE ${owned};`,
    `UPDATE workspace SET mutation_id='initialized' WHERE id=1 AND ${owned};`,
  );
  return statements.join('\n');
}
