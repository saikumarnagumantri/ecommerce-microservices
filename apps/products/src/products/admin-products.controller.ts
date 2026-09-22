import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role, Roles } from '@salescart/common';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { BulkCreateProductsDto, CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { ReplaceFeaturesDto } from './dto/feature.dto';
import { AddMediaDto, UpdateMediaDto } from './dto/media.dto';
import { BulkCreateProductsResultDto, PagedProductsDto, ProductDetailDto, ProductMediaResponseDto } from './dto/product.dto';

@ApiTags('admin/products')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOkResponse({ type: PagedProductsDto })
  findAll(@Query() query: ProductQueryDto): Promise<PagedProductsDto> {
    return this.productsService.adminFindAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductDetailDto })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductDetailDto> {
    return this.productsService.adminFindDetailById(id);
  }

  @Post()
  @ApiOkResponse({ type: ProductDetailDto })
  create(@Body() dto: CreateProductDto): Promise<ProductDetailDto> {
    return this.productsService.create(dto);
  }

  @Post('bulk')
  @ApiOkResponse({ type: BulkCreateProductsResultDto })
  createBulk(@Body() dto: BulkCreateProductsDto): Promise<BulkCreateProductsResultDto> {
    return this.productsService.createBulk(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProductDetailDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDetailDto> {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Product deactivated (soft-deleted)' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productsService.softDelete(id);
  }

  @Put(':id/features')
  @ApiOkResponse({ type: ProductDetailDto })
  replaceFeatures(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceFeaturesDto,
  ): Promise<ProductDetailDto> {
    return this.productsService.replaceFeatures(id, dto);
  }

  @Post(':id/media')
  @ApiOkResponse({ type: ProductMediaResponseDto })
  addMedia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMediaDto,
  ): Promise<ProductMediaResponseDto> {
    return this.productsService.addMedia(id, dto);
  }

  @Patch(':id/media/:mediaId')
  @ApiOkResponse({ type: ProductMediaResponseDto })
  updateMedia(
    @Param('id', ParseIntPipe) id: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
    @Body() dto: UpdateMediaDto,
  ): Promise<ProductMediaResponseDto> {
    return this.productsService.updateMedia(id, mediaId, dto);
  }

  @Delete(':id/media/:mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Media item removed' })
  removeMedia(
    @Param('id', ParseIntPipe) id: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
  ): Promise<void> {
    return this.productsService.removeMedia(id, mediaId);
  }
}
