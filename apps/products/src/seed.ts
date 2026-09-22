import { AppDataSource } from './data-source';
import { Product } from './products/entities/product.entity';
import { PRODUCTS } from './products/data/products.data';

/**
 * Loads the sample catalog into the products table. Safe to re-run: it
 * upserts by id rather than failing on a duplicate key.
 */
async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Product);

  const rows = PRODUCTS.map((p) => ({
    ...p,
    spec: { ...p.spec, yearOfManufacture: p.spec.yearOfManufacture.toISOString() },
  }));

  await repo.upsert(rows, ['id']);
  console.log(`Seeded ${rows.length} products.`);

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
