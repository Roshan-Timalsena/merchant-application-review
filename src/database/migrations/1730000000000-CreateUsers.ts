import { MigrationInterface, QueryRunner } from 'typeorm';

// Dummy password for seeding: Password123!
const SEED_PASSWORD_HASH =
  '$2b$10$KnPySlDo5w/jnsj/wel0H.KdvwZ4ZFMf3sq0CFO16yuVljUFQCiDi';

export class CreateUsers1730000000000 implements MigrationInterface {
  name = 'CreateUsers1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'reviewer', 'sales')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'sales',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `
      INSERT INTO "users" ("email", "password_hash", "role")
      VALUES
        ($1, $2, 'admin'),
        ($3, $2, 'reviewer'),
        ($4, $2, 'sales')
      `,
      [
        'admin@example.com',
        SEED_PASSWORD_HASH,
        'reviewer@example.com',
        'sales@example.com',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
