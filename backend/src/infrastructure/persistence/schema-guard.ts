import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Fails startup when, after migrations, the database schema differs from the entities: better a
 * clear boot failure than a service that starts and breaks on its first write. Fix it with a
 * migration, never by re-enabling synchronize.
 */
@Injectable()
export class SchemaGuard implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    const pending = await this.dataSource.driver.createSchemaBuilder().log();
    if (pending.upQueries.length > 0) {
      throw new Error(
        `Database schema differs from the entities (${pending.upQueries.length.toString()} change(s) pending): add a migration`,
      );
    }
  }
}
