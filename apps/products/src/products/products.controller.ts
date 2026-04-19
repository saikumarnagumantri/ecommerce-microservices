import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ProductDTO } from "./dto/product.dto";
import { ProductsService } from "./products.service";
import { BadRequestException, Controller, Get, Logger, Param } from "@nestjs/common";

@ApiTags('products')
@Controller('products')
export class ProductsController {

  constructor(private readonly productService: ProductsService) {
    
  }
private readonly logger = new Logger(ProductsController.name)
  @Get()
  @ApiOkResponse({ type: ProductDTO, isArray: true })
  getProducts(): ProductDTO[] {
    return this.productService.getProducts();
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductDTO })
  getProductById(@Param('id') id: number): ProductDTO | undefined {
      const productId = Number(id);

    if(isNaN(productId)){
      this.logger.warn(`Invalid product id: ${id}`)
      throw new BadRequestException(`Invalid product id: ${id}`)
    }
    return this.productService.getProductById(Number(productId));
  }
}