/**
 * Node 22 ships `node:sqlite`, but the @types/node 20 pin from Next.js does not
 * declare it yet. This is a minimal surface for the methods we actually call.
 */
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export class StatementSync {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
}
