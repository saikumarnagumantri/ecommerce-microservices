import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersTables1758521400000 implements MigrationInterface {
  name = 'CreateOrdersTables1758521400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "orders"`);

    await queryRunner.query(`
      CREATE TABLE "orders"."orders" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'PLACED',
        "totalAmount" integer NOT NULL,
        "shippingAddress" jsonb NOT NULL,
        "paymentMethod" character varying(16) NOT NULL DEFAULT 'COD',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_orders_userId" ON "orders"."orders" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_status" ON "orders"."orders" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "orders"."order_items" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "productId" integer NOT NULL,
        "name" character varying(255) NOT NULL,
        "price" integer NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"."orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_order_items_orderId" ON "orders"."order_items" ("orderId")`);

    await queryRunner.query(`
      CREATE TABLE "orders"."order_events" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "status" character varying(16) NOT NULL,
        "note" text,
        "actorId" integer NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_events_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"."orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_order_events_orderId" ON "orders"."order_events" ("orderId")`);

    await queryRunner.query(`
      CREATE TABLE "orders"."shipments" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "carrier" character varying(128) NOT NULL,
        "trackingNumber" character varying(128) NOT NULL,
        "dispatchedAt" timestamptz NOT NULL,
        "deliveredAt" timestamptz,
        CONSTRAINT "PK_shipments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shipments_orderId" UNIQUE ("orderId"),
        CONSTRAINT "FK_shipments_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"."orders"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "orders"."shipments"`);
    await queryRunner.query(`DROP TABLE "orders"."order_events"`);
    await queryRunner.query(`DROP TABLE "orders"."order_items"`);
    await queryRunner.query(`DROP TABLE "orders"."orders"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "orders"`);
  }
}
