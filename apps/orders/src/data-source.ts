import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { OrderEvent } from './orders/entities/order-event.entity';
import { Shipment } from './orders/entities/shipment.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'salescart',
  password: process.env.DB_PASSWORD ?? 'salescart',
  database: process.env.DB_DATABASE ?? 'salescart',
  // No top-level `schema`: see apps/products/src/data-source.ts for why.
  entities: [Order, OrderItem, OrderEvent, Shipment],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

export const AppDataSource = new DataSource(dataSourceOptions);
