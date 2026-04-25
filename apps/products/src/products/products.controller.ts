import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductDTO } from './dto/product.dto';
import { ProductsService } from './products.service';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Query,
} from '@nestjs/common';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productService: ProductsService) {}
  private readonly logger = new Logger(ProductsController.name);
  @Get()
  @ApiOkResponse({ type: ProductDTO, isArray: true })
  getProducts(): ProductDTO[] {
    return this.productService.getProducts();
  }
  @Get('bulk-by-product/')
  @ApiQuery({ name: 'productIds', required: true, example: '101,102' })
  @ApiOkResponse({ type: ProductDTO, isArray: true })
  getBulkInventory(@Query('productIds') productIds: string) {
    console.log(productIds);
    if (this.isProductIdValid(productIds)) {
      return this.productService.getProductsByIds(productIds);
    }
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductDTO })
  getProductById(@Param('id') id: number): ProductDTO | undefined {
    const productId = Number(id);

    if (isNaN(productId)) {
      this.logger.warn(`Invalid product id: ${id}`);
      throw new BadRequestException(`Invalid product id: ${id}`);
    }
    return this.productService.getProductById(Number(productId));
  }

  isProductIdValid(productId) {
    const productReg = new RegExp(/^[0-9,]+$/);
    if (!productReg.test(productId)) {
      this.logger.warn(`Invalid Product Id ${productId}`);
      throw new BadRequestException(`Invalid Products ${productId}`);
    }
    return true;
  }
}
