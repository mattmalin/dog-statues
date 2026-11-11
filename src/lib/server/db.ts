import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import sql from 'mssql';
import { config } from './config';

type Values = Record<string, string | number | null>;
type Store = {
  all<T>(statement: string, params?: Values): Promise<T[]>;
  run(statement: string, params?: Values): Promise<void>;
};
type Client = Store & { write<T>(work: (db: Store) => Promise<T>): Promise<T> };

function sqliteClient(): Client {
  mkdirSync(config.dataDir, { recursive: true });
  const db = new DatabaseSync(join(config.dataDir, 'atlas.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('PRAGMA user_version').get();
    if (row?.user_version === 0) {
      db.exec(readFileSync('migrations/sqlite/001_atlas.sql', 'utf8'));
      db.exec('PRAGMA user_version=1');
    }
    db.exec('COMMIT');
  } catch (cause) {
    db.exec('ROLLBACK');
    throw cause;
  }

  const store: Store = {
    async all<T>(statement: string, params: Record<string, SQLInputValue> = {}) {
      return db.prepare(statement).all(params) as T[];
    },
    async run(statement, params = {}) {
      db.prepare(statement).run(params);
    },
  };

  // Serialize use of the connection so reads can't join an in-flight write transaction.
  let queue = Promise.resolve();
  function serial<T>(work: () => Promise<T>) {
    const next = queue.then(work);
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  return {
    all: (statement, params) => serial(() => store.all(statement, params)),
    run: (statement, params) => serial(() => store.run(statement, params)),
    write: (work) =>
      serial(async () => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const result = await work(store);
          db.exec('COMMIT');
          return result;
        } catch (cause) {
          db.exec('ROLLBACK');
          throw cause;
        }
      }),
  };
}

function sqlServerClient(connectionString: string): Client {
  const settings = sql.ConnectionPool.parseConnectionString(connectionString);
  // Route IDs and existing Blob keys use lowercase UUIDs.
  settings.options.lowerCaseGuids = true;
  const pool = new sql.ConnectionPool(settings);
  let connection: Promise<sql.ConnectionPool> | undefined;
  function connect() {
    connection ??= pool.connect().catch((cause) => {
      connection = undefined;
      throw cause;
    });
    return connection;
  }
  pool.on('error', () => console.error('Atlas SQL pool connection error.'));

  function store(getRequest: () => Promise<sql.Request>): Store {
    async function query<T>(statement: string, params: Values = {}) {
      const request = await getRequest();
      for (const [name, value] of Object.entries(params)) request.input(name, value);
      return request.query<T>(statement);
    }
    return {
      async all<T>(statement: string, params?: Values) {
        return (await query<T>(statement, params)).recordset;
      },
      run: async (statement, params) => {
        await query(statement, params);
      },
    };
  }

  return {
    ...store(async () => (await connect()).request()),
    async write(work) {
      const transaction = (await connect()).transaction();
      await transaction.begin();
      try {
        const result = await work(store(async () => transaction.request()));
        await transaction.commit();
        return result;
      } catch (cause) {
        await transaction.rollback().catch(() => {});
        throw cause;
      }
    },
  };
}

let client: Client | undefined;
export function database() {
  return (client ??= config.sql ? sqlServerClient(config.sql) : sqliteClient());
}

export const writeLock = config.sql ? 'WITH (UPDLOCK, HOLDLOCK)' : '';
