import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchantApplicationsAndAuditLogs1730000001000 implements MigrationInterface {
  name = 'CreateMerchantApplicationsAndAuditLogs1730000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."merchant_applications_business_type_enum" AS ENUM(
        'sole_proprietor', 'llc', 'corporation', 'partnership', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."merchant_applications_status_enum" AS ENUM(
        'draft', 'submitted', 'in_review', 'approved', 'rejected', 'info_requested'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."merchant_applications_risk_status_enum" AS ENUM(
        'not_assessed', 'low', 'medium', 'high'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."merchant_applications_kyb_check_status_enum" AS ENUM(
        'pending', 'completed', 'failed'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."audit_logs_action_enum" AS ENUM(
        'application.created',
        'application.submitted',
        'application.assigned',
        'application.review_decision',
        'application.kyb_completed'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."audit_logs_actor_type_enum" AS ENUM('user', 'system')
    `);

    await queryRunner.query(`
      CREATE TABLE "merchant_applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_name" character varying NOT NULL,
        "legal_business_name" character varying NOT NULL,
        "business_type" "public"."merchant_applications_business_type_enum" NOT NULL,
        "owner_name" character varying NOT NULL,
        "contact_email" character varying NOT NULL,
        "contact_phone" character varying NOT NULL,
        "requested_monthly_volume" numeric(14,2) NOT NULL,
        "average_ticket_size" numeric(14,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "mcc" character varying(8),
        "status" "public"."merchant_applications_status_enum" NOT NULL DEFAULT 'draft',
        "risk_status" "public"."merchant_applications_risk_status_enum" NOT NULL DEFAULT 'not_assessed',
        "reviewer_notes" text,
        "created_by_id" uuid NOT NULL,
        "assigned_reviewer_id" uuid,
        "submission_version" integer NOT NULL DEFAULT 0,
        "kyb_check_status" "public"."merchant_applications_kyb_check_status_enum",
        "kyb_provider_ref" character varying,
        "kyb_result" jsonb,
        "kyb_checked_at" TIMESTAMP WITH TIME ZONE,
        "last_risk_job_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchant_applications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_merchant_applications_created_by"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_merchant_applications_assigned_reviewer"
          FOREIGN KEY ("assigned_reviewer_id") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_merchant_applications_status"
        ON "merchant_applications" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_merchant_applications_created_by_id"
        ON "merchant_applications" ("created_by_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_merchant_applications_assigned_reviewer_id"
        ON "merchant_applications" ("assigned_reviewer_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action" "public"."audit_logs_action_enum" NOT NULL,
        "entity_type" character varying NOT NULL,
        "entity_id" character varying NOT NULL,
        "actor_user_id" uuid,
        "actor_type" "public"."audit_logs_actor_type_enum" NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_entity"
        ON "audit_logs" ("entity_type", "entity_id")
    `);

    // Dummy reviewer for object-level e2e (password: Password123!)
    await queryRunner.query(
      `
      INSERT INTO "users" ("email", "password_hash", "role")
      VALUES ($1, $2, 'reviewer')
      ON CONFLICT ("email") DO NOTHING
      `,
      [
        'reviewer2@example.com',
        '$2b$10$KnPySlDo5w/jnsj/wel0H.KdvwZ4ZFMf3sq0CFO16yuVljUFQCiDi',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "merchant_applications"`);
    await queryRunner.query(`DROP TYPE "public"."audit_logs_actor_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."merchant_applications_kyb_check_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."merchant_applications_risk_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."merchant_applications_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."merchant_applications_business_type_enum"`,
    );
  }
}
