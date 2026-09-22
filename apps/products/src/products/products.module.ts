import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductFeature } from './entities/product-feature.entity';
import { ProductMedia } from './entities/product-media.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductFeature, ProductMedia])],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
