import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds per-item dispatch tracking, the partial-dispatch reason/comment on
 * shipments, and the customer-facing "unseen update" flag + cancel
 * reason/comment on orders. See docs/superpowers/specs/2026-09-23-order-fulfillment-overhaul-design.md.
 */
export class AddPartialDispatchAndNotifications1758610000000 implements MigrationInterface {
  name = 'AddPartialDispatchAndNotifications1758610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"."order_items" ADD COLUMN "dispatchStatus" character varying(16) NOT NULL DEFAULT 'PENDING'`);
    // Backfill: items on an order that already shipped are, by definition, already dispatched.
    await queryRunner.query(`
      UPDATE "orders"."order_items"
      SET "dispatchStatus" = 'DISPATCHED'
      WHERE "orderId" IN (SELECT "id" FROM "orders"."orders" WHERE "status" IN ('DISPATCHED', 'DELIVERED'))
    `);

    await queryRunner.query(`ALTER TABLE "orders"."shipments" ADD COLUMN "isPartial" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "orders"."shipments" ADD COLUMN "reason" character varying(32)`);
    await queryRunner.query(`ALTER TABLE "orders"."shipments" ADD COLUMN "comment" text`);

    await queryRunner.query(`ALTER TABLE "orders"."orders" ADD COLUMN "hasUnseenUpdate" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" ADD COLUMN "cancelReason" character varying(32)`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" ADD COLUMN "cancelComment" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"."orders" DROP COLUMN "cancelComment"`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" DROP COLUMN "cancelReason"`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" DROP COLUMN "hasUnseenUpdate"`);

    await queryRunner.query(`ALTER TABLE "orders"."shipments" DROP COLUMN "comment"`);
    await queryRunner.query(`ALTER TABLE "orders"."shipments" DROP COLUMN "reason"`);
    await queryRunner.query(`ALTER TABLE "orders"."shipments" DROP COLUMN "isPartial"`);

    await queryRunner.query(`ALTER TABLE "orders"."order_items" DROP COLUMN "dispatchStatus"`);
  }
}
