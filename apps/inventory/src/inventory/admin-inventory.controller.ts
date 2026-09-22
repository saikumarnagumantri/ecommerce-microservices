import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role, Roles } from '@salescart/common';
import { InventoryService } from './inventory.service';
import {
  AdjustStockDto,
  InventoryDTO,
  LowStockQueryDto,
  RestockDto,
  UpdateInventoryByProductIdDTO,
} from '../dto/inventory.dto';

@ApiTags('admin/inventory')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOkResponse({ type: InventoryDTO, isArray: true })
  findAll(): Promise<InventoryDTO[]> {
    return this.inventoryService.getFullInventory();
  }

  @Get('low-stock')
  @ApiOkResponse({ type: InventoryDTO, isArray: true })
  lowStock(@Query() query: LowStockQueryDto): Promise<InventoryDTO[]> {
    return this.inventoryService.getLowStock(query.threshold);
  }

  @Patch(':productId')
  @ApiOkResponse({ description: 'Stock set to an exact value' })
  setStock(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateInventoryByProductIdDTO,
  ) {
    return this.inventoryService.updateInventoryByProduct(String(productId), dto);
  }

  @Post(':productId/restock')
  @ApiOkResponse({ type: InventoryDTO })
  restock(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: RestockDto,
  ): Promise<InventoryDTO> {
    return this.inventoryService.restock(productId, dto);
  }

  @Patch(':productId/adjust')
  @ApiOkResponse({ type: InventoryDTO })
  adjust(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: AdjustStockDto,
  ): Promise<InventoryDTO> {
    return this.inventoryService.adjustStock(productId, dto);
  }
}
