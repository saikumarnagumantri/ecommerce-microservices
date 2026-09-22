import { AppDataSource } from './data-source';
import { Product } from './products/entities/product.entity';
import { ProductFeature } from './products/entities/product-feature.entity';
import { ProductMedia, MediaType } from './products/entities/product-media.entity';

const CATEGORIES = [
  { id: 1, name: 'Electronics', parentId: null },
  { id: 2, name: 'Furniture', parentId: null },
  { id: 3, name: 'Home Appliances', parentId: null },
];

const PRODUCTS: Array<{
  id: number;
  name: string;
  description: string;
  categoryId: number;
  brand: string;
  originalPrice: number;
  discountPrice: number;
  features: Array<{ label: string; value: string }>;
  images: string[];
}> = [
  {
    id: 101,
    name: 'UltraBook Pro 15',
    description: 'Professional grade laptop with 4K OLED display.',
    categoryId: 1,
    brand: 'TechNova',
    originalPrice: 1500,
    discountPrice: 1350,
    features: [
      { label: 'Display', value: '15" 4K OLED' },
      { label: 'Material', value: 'Aluminum' },
      { label: 'Battery', value: 'Up to 14h' },
    ],
    images: ['laptop1.jpg', 'laptop2.jpg'],
  },
  {
    id: 202,
    name: 'ErgoChair Executive',
    description: 'High-back mesh chair with lumbar support.',
    categoryId: 2,
    brand: 'ComfortPlus',
    originalPrice: 450,
    discountPrice: 399,
    features: [
      { label: 'Material', value: 'Recycled Plastic & Mesh' },
      { label: 'Adjustable Height', value: 'Yes' },
    ],
    images: ['chair1.jpg'],
  },
  {
    id: 303,
    name: 'NoiseCancel 700',
    description: 'Wireless over-ear headphones with active noise cancelling.',
    categoryId: 1,
    brand: 'AudioPure',
    originalPrice: 350,
    discountPrice: 299,
    features: [
      { label: 'Material', value: 'Synthetic Leather' },
      { label: 'Battery', value: 'Up to 20h' },
      { label: 'Noise Cancelling', value: 'Active' },
    ],
    images: ['headphone.jpg'],
  },
  {
    id: 404,
    name: 'SmartWatch Series 9',
    description: 'Fitness tracker and smartwatch with heart rate monitor.',
    categoryId: 1,
    brand: 'TechNova',
    originalPrice: 500,
    discountPrice: 450,
    features: [
      { label: 'Material', value: 'Titanium' },
      { label: 'Battery', value: 'Up to 18h' },
      { label: 'Water Resistance', value: '5 ATM' },
    ],
    images: ['watch1.jpg', 'watch2.jpg'],
  },
  {
    id: 505,
    name: 'Gourmet Coffee Maker',
    description: 'Automatic drip coffee machine with built-in grinder.',
    categoryId: 3,
    brand: 'HomeChef',
    originalPrice: 250,
    discountPrice: 210,
    features: [
      { label: 'Material', value: 'Stainless Steel' },
      { label: 'Capacity', value: '1.8L' },
    ],
    images: ['coffee_machine.jpg'],
  },
];

const MEDIA_BASE_URL = process.env.PRODUCT_IMAGE_URL ?? 'http://localhost:3005/media';

async function seed() {
  await AppDataSource.initialize();

  const productRepo = AppDataSource.getRepository(Product);
  const featureRepo = AppDataSource.getRepository(ProductFeature);
  const mediaRepo = AppDataSource.getRepository(ProductMedia);

  // Not repo.upsert(): TypeORM's upsert on a @PrimaryGeneratedColumn does
  // not honor an explicit id (it inserts via nextval() regardless), so
  // this seed's fixed sample ids need a raw parameterized upsert instead.
  for (const c of CATEGORIES) {
    await AppDataSource.query(
      `INSERT INTO "products"."categories" ("id","name","parentId") VALUES ($1,$2,$3)
       ON CONFLICT ("id") DO UPDATE SET name = EXCLUDED.name, "parentId" = EXCLUDED."parentId"`,
      [c.id, c.name, c.parentId],
    );
  }

  for (const p of PRODUCTS) {
    await AppDataSource.query(
      `INSERT INTO "products"."products"
         ("id","name","description","categoryId","brand","originalPrice","discountPrice","isActive")
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       ON CONFLICT ("id") DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, "categoryId" = EXCLUDED."categoryId",
         brand = EXCLUDED.brand, "originalPrice" = EXCLUDED."originalPrice", "discountPrice" = EXCLUDED."discountPrice"`,
      [p.id, p.name, p.description, p.categoryId, p.brand, p.originalPrice, p.discountPrice],
    );

    await featureRepo.delete({ productId: p.id });
    await featureRepo.save(
      p.features.map((f, index) => ({ productId: p.id, label: f.label, value: f.value, sortOrder: index })),
    );

    await mediaRepo.delete({ productId: p.id });
    await mediaRepo.save(
      p.images.map((filename, index) => ({
        productId: p.id,
        type: MediaType.IMAGE,
        url: `${MEDIA_BASE_URL}/${filename}`,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    );
  }

  // ids were inserted explicitly into serial columns; bump the sequences
  // so the next admin-created row doesn't collide with the sample data.
  await AppDataSource.query(
    `SELECT setval(pg_get_serial_sequence('"products"."products"', 'id'), (SELECT MAX(id) FROM "products"."products"))`,
  );
  await AppDataSource.query(
    `SELECT setval(pg_get_serial_sequence('"products"."categories"', 'id'), (SELECT MAX(id) FROM "products"."categories"))`,
  );

  console.log(`Seeded ${CATEGORIES.length} categories and ${PRODUCTS.length} products (with features and media).`);
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
