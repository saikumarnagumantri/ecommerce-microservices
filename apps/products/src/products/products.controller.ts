import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ProductDTO } from "./dto/product.dto";
import { ProductsService } from "./products.service";
import { Controller, Get, Param } from "@nestjs/common";

@ApiTags('products')
@Controller('products')
export class ProductsController {

  constructor(private readonly productService: ProductsService) {}

  @Get()
  @ApiOkResponse({ type: ProductDTO, isArray: true })
  getProducts(): ProductDTO[] {
    return this.productService.getProducts();
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductDTO })
  getProductById(@Param('id') id: string): ProductDTO | undefined {
    return this.productService.getProductById(Number(id));
  }
}