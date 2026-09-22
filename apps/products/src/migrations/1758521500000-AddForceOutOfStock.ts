import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin override to mark a product out of stock regardless of its real
 * inventory count (recalls, supplier issues, etc.) — separate from and
 * never written by the inventory service.
 */
export class AddForceOutOfStock1758521500000 implements MigrationInterface {
  name = 'AddForceOutOfStock1758521500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"."products"
      ADD COLUMN "forceOutOfStock" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products"."products" DROP COLUMN "forceOutOfStock"`);
  }
}
