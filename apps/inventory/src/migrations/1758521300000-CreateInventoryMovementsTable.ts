import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryMovementsTable1758521300000 implements MigrationInterface {
  name = 'CreateInventoryMovementsTable1758521300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inventory"."inventory_movements" (
        "id" SERIAL NOT NULL,
        "productId" integer NOT NULL,
        "delta" integer NOT NULL,
        "reason" character varying(16) NOT NULL,
        "refId" character varying(64),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_movements_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_movements_productId" ON "inventory"."inventory_movements" ("productId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inventory"."inventory_movements"`);
  }
}
