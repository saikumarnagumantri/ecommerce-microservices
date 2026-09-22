import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryTable1758520900000 implements MigrationInterface {
  name = 'CreateInventoryTable1758520900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "inventory"`);
    await queryRunner.query(`
      CREATE TABLE "inventory"."inventory" (
        "productId" integer NOT NULL,
        "stock" integer NOT NULL,
        "isAvailable" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_inventory_productId" PRIMARY KEY ("productId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inventory"."inventory"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "inventory"`);
  }
}
