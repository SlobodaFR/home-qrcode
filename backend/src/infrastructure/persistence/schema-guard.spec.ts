import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';
import { SchemaGuard } from './schema-guard';

async function source(migrate: boolean): Promise<DataSource> {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false,
  });
  await ds.initialize();
  if (migrate) await ds.runMigrations();
  return ds;
}

describe('SchemaGuard', () => {
  it('lets a migrated database start', async () => {
    const ds = await source(true);

    await expect(new SchemaGuard(ds).onModuleInit()).resolves.toBeUndefined();
    await ds.destroy();
  });

  it('refuses to start when the schema differs from the entities', async () => {
    const ds = await source(false);

    await expect(new SchemaGuard(ds).onModuleInit()).rejects.toThrow(
      /differs from the entities.*add a migration/,
    );
    await ds.destroy();
  });

  it('refuses a migrated database that has drifted', async () => {
    const ds = await source(true);
    await ds.query('DROP INDEX "IDX_97672ac88f789774dd47f7c8be"');

    await expect(new SchemaGuard(ds).onModuleInit()).rejects.toThrow(
      /differs from the entities/,
    );
    await ds.destroy();
  });
});
