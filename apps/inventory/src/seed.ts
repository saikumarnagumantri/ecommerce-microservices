import { AppDataSource } from './data-source';
import { Inventory } from './entities/inventory.entity';
import { INVENTORY } from './data/inventory.data';

/** Loads the sample stock levels. Safe to re-run: upserts by productId. */
async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Inventory);

  await repo.upsert(INVENTORY, ['productId']);
  console.log(`Seeded ${INVENTORY.length} inventory rows.`);

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
