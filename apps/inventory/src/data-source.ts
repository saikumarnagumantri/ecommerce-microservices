import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Inventory } from './entities/inventory.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'salescart',
  password: process.env.DB_PASSWORD ?? 'salescart',
  database: process.env.DB_DATABASE ?? 'salescart',
  // No top-level `schema`: see products/src/data-source.ts for why.
  entities: [Inventory],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

export const AppDataSource = new DataSource(dataSourceOptions);
