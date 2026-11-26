import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema as created by `synchronize: true` until now. IF NOT EXISTS everywhere: on the existing
 * production database this migration changes nothing and only records itself; on an empty
 * database it creates the schema. Hand-written: raw `migration:generate` output (no IF NOT
 * EXISTS) would crash on the production database.
 *
 * The trailing space after the index column lists is what TypeORM writes: kept so sqlite_master
 * is byte-identical to a synchronize-built database.
 *
 * Only ever use the `queryRunner` passed in (never `dataSource.query`): migrations run on the
 * serialized connection. There is deliberately no CLI data source, and `down()` refuses to run: it would drop the data.
 */
export class InitialSchema1795600000000 implements MigrationInterface {
  name = 'InitialSchema1795600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "qr_codes" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "content_type" text NOT NULL, "content" text NOT NULL, "size" integer NOT NULL, "fg_color" text NOT NULL, "bg_color" text NOT NULL, "error_correction" text NOT NULL, "scan_count" integer NOT NULL DEFAULT (0), "encoded_content" text, "has_logo" boolean NOT NULL DEFAULT (0), "logo_mime_type" text, "source" text, "expires_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "qr_shares" ("id" text PRIMARY KEY NOT NULL, "qr_id" text NOT NULL, "owner_id" text NOT NULL, "recipient_id" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_4e89993f3ba6bef20cba3e4b92a" UNIQUE ("qr_id", "recipient_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "revoked_sessions" ("user_id" text PRIMARY KEY NOT NULL, "revoked_at" datetime NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" ("id" text PRIMARY KEY NOT NULL, "email" text NOT NULL, "name" text NOT NULL, "avatar_url" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_d142e1d0837abfd6b6891b8959" ON "qr_codes" ("user_id", "created_at") `,
    );
  }

  // Reverting the baseline would drop every table, and the data with them.
  down(): Promise<void> {
    return Promise.reject(
      new Error('baseline migration: revert not supported, restore a backup'),
    );
  }
}
