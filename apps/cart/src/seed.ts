import { AppDataSource } from './data-source';
import { CartItem } from './cart/entities/cart-item.entity';
import { CARTDATA } from './cart/data/cart.data';

/**
 * Loads sample cart rows for local development. Not upserted by a
 * natural key (cart rows have no meaningful external id), so this only
 * inserts when the table is empty — safe to run multiple times without
 * duplicating rows.
 */
async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(CartItem);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(`Cart already has ${existing} rows, skipping seed.`);
  } else {
    await repo.save(CARTDATA);
    console.log(`Seeded ${CARTDATA.length} cart rows.`);
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
