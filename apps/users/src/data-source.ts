import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from './users/entities/user.entity';
import { Address } from './users/entities/address.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'salescart',
  password: process.env.DB_PASSWORD ?? 'salescart',
  database: process.env.DB_DATABASE ?? 'salescart',
  // No top-level `schema`: see apps/products/src/data-source.ts for why.
  entities: [User, Address],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

export const AppDataSource = new DataSource(dataSourceOptions);
