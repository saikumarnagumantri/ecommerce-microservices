import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E2 catalog redesign. Replaces the E0-4 `products` shape (`category`
 * int, `spec` jsonb, `offers` jsonb, `images` text[], `isOutOfStock`)
 * with a real `categories` table, `categoryId` FK + `brand` + `isActive`
 * on products, and dedicated `product_features` / `product_media`
 * tables. This is still dev-stage sample data, so this drops and
 * recreates `products` rather than writing a column-by-column ALTER +
 * backfill; `down()` is one-way (drops everything it created) rather
 * than resurrecting the old shape.
 */
export class CatalogRedesign1758521200000 implements MigrationInterface {
  name = 'CatalogRedesign1758521200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "products"."products"`);

    await queryRunner.query(`
      CREATE TABLE "products"."categories" (
        "id" SERIAL NOT NULL,
        "name" character varying(128) NOT NULL,
        "parentId" integer,
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "products"."products" (
        "id" SERIAL NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "categoryId" integer NOT NULL,
        "brand" character varying(128) NOT NULL,
        "originalPrice" integer NOT NULL,
        "discountPrice" integer NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_categoryId" FOREIGN KEY ("categoryId") REFERENCES "products"."categories"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "products"."product_features" (
        "id" SERIAL NOT NULL,
        "productId" integer NOT NULL,
        "label" character varying(128) NOT NULL,
        "value" character varying(255) NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_product_features_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_features_productId" FOREIGN KEY ("productId") REFERENCES "products"."products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_product_features_productId" ON "products"."product_features" ("productId")`);

    await queryRunner.query(`
      CREATE TABLE "products"."product_media" (
        "id" SERIAL NOT NULL,
        "productId" integer NOT NULL,
        "type" character varying(16) NOT NULL,
        "url" text NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isPrimary" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_product_media_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_media_productId" FOREIGN KEY ("productId") REFERENCES "products"."products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_product_media_productId" ON "products"."product_media" ("productId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "products"."product_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"."product_features"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"."products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"."categories"`);
  }
}
