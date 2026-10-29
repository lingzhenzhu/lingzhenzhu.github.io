import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';

/** Executes application SQL against SQLite; it is not a substitute for remote D1 tests. */
export function testDatabase(legacy = false) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('apps/studio/migrations/0001_initial.sql', 'utf8'));
  sqlite.exec(readFileSync('apps/studio/migrations/0002_rewards.sql', 'utf8'));
  if (!legacy) sqlite.exec(readFileSync('apps/studio/migrations/0003_resource_storage.sql', 'utf8'));
  class Statement {
    constructor(
      readonly sql: string,
      readonly values: SQLInputValue[] = [],
    ) {}
    bind(...values: SQLInputValue[]) {
      return new Statement(this.sql, values);
    }
    async first() {
      return sqlite.prepare(this.sql).get(...this.values) ?? null;
    }
    async run() {
      return this.execute();
    }
    async all() {
      return { results: sqlite.prepare(this.sql).all(...this.values), success: true };
    }
    execute() {
      if (/^\s*(SELECT|WITH)/i.test(this.sql))
        return { success: true, results: sqlite.prepare(this.sql).all(...this.values), meta: { changes: 0 } };
      const result = sqlite.prepare(this.sql).run(...this.values);
      return { success: true, results: [], meta: { changes: Number(result.changes) } };
    }
  }
  const DB = {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: Statement[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;
  return { DB, sqlite };
}
