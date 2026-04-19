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
}
