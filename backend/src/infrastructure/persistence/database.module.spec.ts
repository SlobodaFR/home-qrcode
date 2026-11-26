import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { DatabaseModule } from './database.module';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

describe('DatabaseModule', () => {
  async function boot() {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ DATABASE_PATH: ':memory:' })],
        }),
        DatabaseModule,
      ],
    }).compile();
    await moduleRef.init();
    return moduleRef;
  }

  it('serializes the transactions of the production connection', async () => {
    const moduleRef = await boot();
    const dataSource = moduleRef.get(DataSource);

    // TypeORM's own driver returns one shared runner for every caller.
    expect(dataSource.createQueryRunner()).not.toBe(
      dataSource.createQueryRunner(),
    );

    await moduleRef.close();
  });

  it('keeps a write made by a concurrent request when another transaction rolls back', async () => {
    const moduleRef = await boot();
    const dataSource = moduleRef.get(DataSource);
    await dataSource.query('CREATE TABLE probe (id TEXT PRIMARY KEY)');

    let aHasWritten!: () => void;
    const aWrote = new Promise<void>((resolve) => (aHasWritten = resolve));
    const a = dataSource
      .transaction(async (manager) => {
        await manager.query("INSERT INTO probe (id) VALUES ('a')");
        aHasWritten();
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new Error('request A fails');
      })
      .catch(() => undefined);
    await aWrote;
    // Request B writes through the plain DataSource while A's transaction is open.
    await dataSource.query("INSERT INTO probe (id) VALUES ('b')");
    await a;

    const rows: { id: string }[] = await dataSource.query(
      'SELECT id FROM probe ORDER BY id',
    );
    expect(rows).toEqual([{ id: 'b' }]);

    await moduleRef.close();
  });

  it('refuses to boot when the migrated database has drifted (SchemaGuard is wired)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'db-'));
    const file = join(dir, 'drift.sqlite');
    try {
      const setup = new DataSource({
        type: 'better-sqlite3',
        database: file,
        entities: ENTITIES,
        migrations: MIGRATIONS,
      });
      await setup.initialize();
      await setup.runMigrations();
      await setup.query('DROP INDEX "IDX_97672ac88f789774dd47f7c8be"');
      await setup.destroy();

      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            load: [() => ({ DATABASE_PATH: file })],
          }),
          DatabaseModule,
        ],
      }).compile();
      await expect(moduleRef.init()).rejects.toThrow(
        /differs from the entities/,
      );
      await moduleRef.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
