/**
 * Ambient type declarations for node:sqlite (experimental).
 * Node 22.5+ ships an experimental SQLite module behind --experimental-sqlite.
 * @types/node@20.x does not include these types, so we declare them here.
 */
declare module "node:sqlite" {
  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeys?: boolean;
    enableDoubleQuotedStringLiterals?: boolean;
  }

  export interface StatementResultingChanges {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
    setReadBigInts(enabled: boolean): void;
    setAllowBareNamedParameters(enabled: boolean): void;
    columns(): Array<{
      column: string | null;
      database: string | null;
      name: string;
      origin: string | null;
      table: string | null;
      type: string | null;
    }>;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    open(): void;
    isOpen(): boolean;
    isTransaction: boolean;
    function(
      name: string,
      options: {
        deterministic?: boolean;
        directOnly?: boolean;
        useBigIntArguments?: boolean;
        varargs?: boolean;
      },
      func: (...args: unknown[]) => unknown,
    ): void;
    function(name: string, func: (...args: unknown[]) => unknown): void;
  }
}
