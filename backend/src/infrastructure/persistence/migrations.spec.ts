import { mkdtempSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';
import { InitialSchema1795600000000 } from './migrations/1795600000000-InitialSchema';

function dataSource(database: string, synchronize = false): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize,
  });
}

const tempFile = (name: string) =>
  join(mkdtempSync(join(tmpdir(), 'db-')), name);

interface MasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

// `migrations` (and sqlite_sequence, created by its AUTOINCREMENT key) only exist with migrations.
const schemaOf = (ds: DataSource): Promise<MasterRow[]> =>
  ds.query(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE tbl_name NOT IN ('migrations', 'sqlite_sequence') ORDER BY type, name`,
  );

const SAMPLE_ROWS = [
  "INSERT INTO users (id, email, name, avatar_url) VALUES ('u1', 'a@example.com', 'Alice', 'http://a'), ('u2', 'b@example.com', 'Bob', 'http://b')",
  "INSERT INTO qr_codes (id, user_id, content_type, content, size, fg_color, bg_color, error_correction, scan_count, encoded_content, has_logo, logo_mime_type, source, expires_at) VALUES ('q1', 'u1', 'url', 'https://e.fr', 256, '#000', '#fff', 'M', 3, 'https://e.fr', 1, 'image/png', 'qr', '2030-01-01 00:00:00'), ('q2', 'u2', 'text', 'hello', 128, '#111', '#eee', 'H', 0, NULL, 0, NULL, NULL, NULL)",
  "INSERT INTO qr_shares (id, qr_id, owner_id, recipient_id) VALUES ('s1', 'q1', 'u1', 'u2')",
  "INSERT INTO revoked_sessions (user_id, revoked_at) VALUES ('u1', '2026-01-01 00:00:00')",
];
const TABLES = ['users', 'qr_codes', 'qr_shares', 'revoked_sessions'];

async function dumpRows(ds: DataSource): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    out[table] = await ds.query(`SELECT * FROM "${table}" ORDER BY 1`);
  }
  return out;
}

describe('database migrations', () => {
  // Any entity change without its migration makes this fail.
  it('produce exactly the schema the entities describe', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();

    const pending = await ds.driver.createSchemaBuilder().log();

    expect(pending.upQueries.map((query) => query.query)).toEqual([]);
    await ds.destroy();
  });

  it('create the same sqlite_master as synchronize does (apart from the migrations table)', async () => {
    const synced = dataSource(':memory:', true);
    await synced.initialize();
    const migrated = dataSource(':memory:');
    await migrated.initialize();
    await migrated.runMigrations();

    expect(await schemaOf(migrated)).toEqual(await schemaOf(synced));
    await synced.destroy();
    await migrated.destroy();
  });

  // Production was created by synchronize: true; the first migration must adopt it untouched.
  it('adopt a database created by synchronize without losing data', async () => {
    const file = tempFile('prod.sqlite');
    const legacy = dataSource(file, true);
    await legacy.initialize();
    for (const sql of SAMPLE_ROWS) await legacy.query(sql);
    const rowsBefore = await dumpRows(legacy);
    const schemaBefore = await schemaOf(legacy);
    await legacy.destroy();

    const migrated = dataSource(file);
    await migrated.initialize();
    const applied = await migrated.runMigrations();

    expect(applied.map((migration) => migration.name)).toEqual(
      MIGRATIONS.map((migration) => migration.name),
    );
    expect(await dumpRows(migrated)).toEqual(rowsBefore);
    expect(await schemaOf(migrated)).toEqual(schemaBefore);
    expect(await migrated.query('SELECT name FROM migrations')).toEqual([
      { name: 'InitialSchema1795600000000' },
    ]);
    expect(
      (await migrated.driver.createSchemaBuilder().log()).upQueries,
    ).toEqual([]);
    expect(await migrated.query('PRAGMA integrity_check')).toEqual([
      { integrity_check: 'ok' },
    ]);
    await migrated.destroy();
  });

  // Production's qr_codes was rebuilt by successive synchronize runs as columns were added
  // (created_at before encoded_content...): the column order differs from a fresh synchronize.
  it('adopt a qr_codes table whose columns are in the historical order', async () => {
    const file = tempFile('prod.sqlite');
    const legacy = dataSource(file, true);
    await legacy.initialize();
    await legacy.query('DROP TABLE qr_codes');
    await legacy.query(
      `CREATE TABLE "qr_codes" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "content_type" text NOT NULL, "content" text NOT NULL, "size" integer NOT NULL, "fg_color" text NOT NULL, "bg_color" text NOT NULL, "error_correction" text NOT NULL, "scan_count" integer NOT NULL DEFAULT (0), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "encoded_content" text, "has_logo" boolean NOT NULL DEFAULT (0), "logo_mime_type" text, "source" text, "expires_at" datetime)`,
    );
    await legacy.query(
      `CREATE INDEX "IDX_d142e1d0837abfd6b6891b8959" ON "qr_codes" ("user_id", "created_at")`,
    );
    for (const sql of SAMPLE_ROWS) await legacy.query(sql);
    const rowsBefore = await dumpRows(legacy);
    const schemaBefore = await schemaOf(legacy);
    await legacy.destroy();

    const migrated = dataSource(file);
    await migrated.initialize();
    await migrated.runMigrations();

    expect(await dumpRows(migrated)).toEqual(rowsBefore);
    expect(await schemaOf(migrated)).toEqual(schemaBefore);
    expect(
      (await migrated.driver.createSchemaBuilder().log()).upQueries,
    ).toEqual([]);
    await migrated.destroy();
  });

  it('keep the qr_shares unique constraint', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();
    const insert = (id: string) =>
      ds.query(
        `INSERT INTO qr_shares (id, qr_id, owner_id, recipient_id) VALUES ('${id}', 'q1', 'u1', 'u2')`,
      );
    await insert('s1');

    await expect(insert('s2')).rejects.toThrow(/UNIQUE/);
    await ds.destroy();
  });

  it('make the initial migration a no-op when it runs again', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();
    const before = await schemaOf(ds);

    const queryRunner = ds.createQueryRunner();
    await new InitialSchema1795600000000().up(queryRunner);
    await queryRunner.release();

    expect(await schemaOf(ds)).toEqual(before);
    await ds.destroy();
  });

  // forFeature() with an entity missing from ENTITIES would fail at boot with "No metadata".
  it('list every @Entity file of the entities folder in ENTITIES', async () => {
    const dir = join(__dirname, 'entities');
    const declared = readdirSync(dir)
      .filter((file) => file.endsWith('.orm-entity.ts'))
      .map(
        (file) =>
          /@Entity\(\{ name: '(\w+)' \}\)/.exec(
            readFileSync(join(dir, file), 'utf8'),
          )?.[1],
      );
    const ds = dataSource(':memory:');
    await ds.initialize();

    expect(ds.entityMetadatas.map((meta) => meta.tableName).sort()).toEqual(
      declared.sort(),
    );
    await ds.destroy();
  });
});
