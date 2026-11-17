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
    const version = Number(row?.user_version);
    if (version === 0) {
      db.exec(readFileSync('migrations/sqlite/001_atlas.sql', 'utf8'));
      db.exec('PRAGMA user_version=1');
    }
    if (version < 2) {
      db.exec(readFileSync('migrations/sqlite/002_instagram.sql', 'utf8'));
      db.exec('PRAGMA user_version=2');
    }
    if (version < 3) {
      db.exec(readFileSync('migrations/sqlite/003_google_maps_pin.sql', 'utf8'));
      db.exec('PRAGMA user_version=3');
    }
    if (version < 4) {
      db.exec(readFileSync('migrations/sqlite/004_instagram_draft.sql', 'utf8'));
      db.exec('PRAGMA user_version=4');
    }
    if (version < 6) {
      db.exec(readFileSync('migrations/sqlite/006_private_publication.sql', 'utf8'));
      for (const row of db.prepare("SELECT * FROM statues WHERE web_status='published'").all()) {
        const photos = db
          .prepare(
            "SELECT id, alt_text, credit, width, height FROM media_assets WHERE statue_id=? AND rights_status='approved' ORDER BY position,id",
          )
          .all(row.id);
        const keys = [
          'slug',
          'title',
          'short_summary',
          'web_description',
          'address',
          'city',
          'region',
          'country',
          'postal_code',
          'google_maps_url',
          'latitude',
          'longitude',
          'cover_media_id',
        ];
        const statue = Object.fromEntries(keys.map((key) => [key, row[key]]));
        db.prepare('UPDATE statues SET published_snapshot=? WHERE id=?').run(
          JSON.stringify({ statue, photos }),
          row.id,
        );
      }
      db.exec('PRAGMA user_version=6');
    }
    if (version < 7) {
      db.exec(readFileSync('migrations/sqlite/007_potential_statues.sql', 'utf8'));
      db.exec('PRAGMA user_version=7');
    }
    if (version < 8) {
      db.exec(readFileSync('migrations/sqlite/008_potential_images.sql', 'utf8'));
      db.exec('PRAGMA user_version=8');
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
