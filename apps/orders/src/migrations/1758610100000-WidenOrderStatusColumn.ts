import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `orders.status` and `order_events.status` were both `varchar(16)`, sized
 * for the original five statuses (longest: DISPATCHED/CONFIRMED/DELIVERED/
 * CANCELLED, all <= 10 chars). `PARTIALLY_DISPATCHED` (21 chars) doesn't
 * fit either column — caught by the e2e script against a live Postgres
 * instance, not by the (mocked-repository) unit tests. Both widened to 32
 * to leave headroom for future statuses too.
 */
export class WidenOrderStatusColumn1758610100000 implements MigrationInterface {
  name = 'WidenOrderStatusColumn1758610100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"."orders" ALTER COLUMN "status" TYPE character varying(32)`);
    await queryRunner.query(`ALTER TABLE "orders"."order_events" ALTER COLUMN "status" TYPE character varying(32)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"."order_events" ALTER COLUMN "status" TYPE character varying(16)`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" ALTER COLUMN "status" TYPE character varying(16)`);
  }
}
