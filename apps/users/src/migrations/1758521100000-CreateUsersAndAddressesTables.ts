import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndAddressesTables1758521100000 implements MigrationInterface {
  name = 'CreateUsersAndAddressesTables1758521100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "users"`);
    await queryRunner.query(`
      CREATE TABLE "users"."users" (
        "id" SERIAL NOT NULL,
        "email" character varying(255) NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "name" character varying(255) NOT NULL,
        "phone" character varying(32),
        "role" character varying(16) NOT NULL DEFAULT 'CUSTOMER',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "users"."addresses" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "line1" character varying(255) NOT NULL,
        "line2" character varying(255),
        "city" character varying(128) NOT NULL,
        "state" character varying(128) NOT NULL,
        "postalCode" character varying(32) NOT NULL,
        "country" character varying(128) NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_addresses_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_addresses_userId" FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_addresses_userId" ON "users"."addresses" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"."addresses"`);
    await queryRunner.query(`DROP TABLE "users"."users"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "users"`);
  }
}
