import { Injectable } from '@nestjs/common';
import { PRODUCTS } from './data/products.data';
import { ProductDTO } from './dto/product.dto';

@Injectable()
export class ProductsService {
  getProducts():ProductDTO[] {
    return PRODUCTS
  }
  getProductById(id: number):ProductDTO | undefined {
    return  PRODUCTS.find(p => p.id === id);
  }
}
