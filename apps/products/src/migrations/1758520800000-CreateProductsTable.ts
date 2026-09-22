import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductsTable1758520800000 implements MigrationInterface {
  name = 'CreateProductsTable1758520800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "products"`);
    await queryRunner.query(`
      CREATE TABLE "products"."products" (
        "id" integer NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "category" integer NOT NULL,
        "spec" jsonb NOT NULL,
        "originalPrice" integer NOT NULL,
        "discountPrice" integer NOT NULL,
        "offers" jsonb NOT NULL DEFAULT '[]',
        "images" text[] NOT NULL DEFAULT '{}',
        "isOutOfStock" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "products"."products"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "products"`);
  }
}
