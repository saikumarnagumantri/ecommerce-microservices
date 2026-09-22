import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  getProducts(): Promise<Product[]> {
    return this.productRepository.find();
  }

  async getProductById(id: number): Promise<Product> {
    const product = await this.productRepository.findOneBy({ id: +id });
    if (!product) {
      this.logger.warn(`Search failed: Product with ID ${id} not found.`);
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    this.logger.log(`Successfully fetched product: ${product.name}`);
    return product;
  }

  async getProductsByIds(productIds: string): Promise<Product[]> {
    if (!productIds) return [];

    const productArray = productIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');

    const idSet = [...new Set(productArray.map((id) => +id))];
    const products = await this.productRepository.findBy({ id: In(idSet) });

    if (products.length === 0) {
      this.logger.warn(`Search failed: Product with ID ${productIds} not found.`);
      throw new NotFoundException(`Product with id ${productIds} not found`);
    }

    if (productArray.length !== products.length) {
      this.logger.warn(
        `Missing products: requested ${productArray.length}, found ${products.length}`,
      );
    }

    return products;
  }
}
