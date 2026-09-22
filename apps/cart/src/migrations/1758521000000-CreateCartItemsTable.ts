import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCartItemsTable1758521000000 implements MigrationInterface {
  name = 'CreateCartItemsTable1758521000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "cart"`);
    await queryRunner.query(`
      CREATE TABLE "cart"."cart_items" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "productId" integer NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_cart_items_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cart_items_user_product" ON "cart"."cart_items" ("userId", "productId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cart"."cart_items"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "cart"`);
  }
}
