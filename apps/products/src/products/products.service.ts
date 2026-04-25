import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PRODUCTS } from './data/products.data';
import { ProductDTO } from './dto/product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  getProducts(): ProductDTO[] {
    return PRODUCTS;
  }
  getProductById(id: number): ProductDTO | undefined {
    const product = PRODUCTS.find((p) => p.id === +id);
    if (!product) {
      // 2. LOG the error for internal tracking (Developer view)
      this.logger.warn(`Search failed: Product with ID ${id} not found.`);

      // 3. THROW the exception for the API response (Client view)
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    this.logger.log(`Successfully fetched product: ${product.name}`);
    return product;
  }

  getProductsByIds(productIds: string): ProductDTO[] | undefined {
    if (!productIds) return [];

    // 1. Clean and parse the input
    // split by comma and optional whitespace, then filter out empty values
    const productArray = productIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');

    // 2. Performance optimization: Use a Set for O(1) lookups
    const idSet = new Set(productArray);

    // 3. Filter inventory ensuring type consistency
    const products = PRODUCTS.filter((inv) => idSet.has(inv.id.toString()));

    // 4. Error Handling
    // Note: .filter() always returns an array, even if empty.
    if (products.length === 0) {
      this.logger.warn(
        `Search failed: Product with ID ${productIds} not found.`,
      );
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
