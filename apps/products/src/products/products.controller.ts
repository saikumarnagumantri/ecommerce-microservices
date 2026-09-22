import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductDetailDto, PagedProductsDto } from './dto/product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';
import { Public } from '@salescart/common';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productService: ProductsService) {}
  private readonly logger = new Logger(ProductsController.name);

  @Public()
  @Get()
  @ApiOkResponse({ type: PagedProductsDto })
  getProducts(@Query() query: ProductQueryDto): Promise<PagedProductsDto> {
    return this.productService.findAll(query);
  }

  @Public()
  @Get('bulk-by-product/')
  @ApiQuery({ name: 'productIds', required: true, example: '101,102' })
  getBulkInventory(@Query('productIds') productIds: string) {
    if (this.isProductIdValid(productIds)) {
      return this.productService.getProductsByIds(productIds);
    }
  }

  @Public()
  @Get(':id')
  @ApiOkResponse({ type: ProductDetailDto })
  getProductById(@Param('id', ParseIntPipe) id: number): Promise<ProductDetailDto> {
    return this.productService.findDetailById(id);
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
