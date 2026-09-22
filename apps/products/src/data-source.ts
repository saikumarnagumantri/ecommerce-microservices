import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Product } from './products/entities/product.entity';

/**
 * Single source of truth for this service's DB connection: used by
 * TypeOrmModule.forRoot in app.module.ts, and by the TypeORM CLI for
 * migrations (`npm run migration:run` etc.), so both always agree.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'salescart',
  password: process.env.DB_PASSWORD ?? 'salescart',
  database: process.env.DB_DATABASE ?? 'salescart',
  // No top-level `schema` here: TypeORM would look for its own migrations
  // bookkeeping table inside that schema before this service's first
  // migration has created it. Each entity names its own schema instead
  // (see Product's @Entity({ schema: 'products' })), and TypeORM's
  // migrations table lives in the default `public` schema.
  entities: [Product],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

export const AppDataSource = new DataSource(dataSourceOptions);
