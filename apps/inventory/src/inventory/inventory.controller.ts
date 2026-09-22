import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { INVENTORY_INVALID_PRODUCT_ID } from '../constants/inventory.constants';
import { InventoryDTO, InventoryOrderPlacedOrCancelDTO, InventoryUpdateDTO } from '../dto/inventory.dto';
import { ApiBody, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { Public } from '@salescart/common';

/**
 * Read access and the internal order/cancel hooks other services call.
 * Admin write operations (restock, adjust, direct stock overwrite,
 * low-stock report) live in AdminInventoryController instead.
 */
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private readonly logger = new Logger(InventoryController.name);

  @Public()
  @Get()
  @ApiOkResponse({ type: InventoryDTO, isArray: true })
  getFullInventory(): Promise<InventoryDTO[]> {
    this.logger.log('Full Inventory list');
    return this.inventoryService.getFullInventory();
  }

  @Public()
  @Get('bulk-by-product')
  @ApiQuery({ name: 'productIds', required: true, example: '101,102' })
  @ApiOkResponse({ type: InventoryDTO, isArray: true })
  getBulkInventory(@Query('productIds') productIds: string) {
    this.isProductIdValid(productIds);
    return this.inventoryService.getInventoryByProductIds(productIds);
  }

  @Public()
  @Get(':productId')
  @ApiOkResponse({ type: InventoryDTO })
  getInventoryByProduct(@Param('productId') productId: number): Promise<InventoryDTO> | undefined {
    if (this.isProductIdValid(productId)) {
      return this.inventoryService.getInventoryByProductId(productId);
    }
  }

  /** Called by the orders service when an order is placed. */
  @Public()
  @Patch('update-stock-ordered')
  @ApiBody({ type: InventoryOrderPlacedOrCancelDTO })
  @ApiOkResponse({ description: 'Stock updated successfully' })
  updateInventoryStockByOrder(@Body() orderedProducts: InventoryOrderPlacedOrCancelDTO) {
    return this.inventoryService.updateInventoryStockByOrder(orderedProducts);
  }

  /** Called by the orders service when an order is cancelled. */
  @Public()
  @Patch('update-stock-cancelled')
  @ApiBody({ type: InventoryOrderPlacedOrCancelDTO })
  @ApiOkResponse({ description: 'Stock updated successfully' })
  updateInventoryStockByCancel(@Body() cancelledProducts: InventoryOrderPlacedOrCancelDTO) {
    return this.inventoryService.updateInventoryStockByCancel(cancelledProducts);
  }

  /** Called by the products service when a new product is created. */
  @Public()
  @Post('new-product-inventory')
  @ApiBody({ type: InventoryUpdateDTO })
  @ApiOkResponse({ description: 'Inventory updated succesfully' })
  addNewProductToInventory(@Body() inventory: InventoryUpdateDTO) {
    return this.inventoryService.addNewProductToInventory(inventory);
  }

  isProductIdValid(productId) {
    const productReg = new RegExp(/^[0-9,]+$/);
    if (!productReg.test(productId)) {
      this.logger.warn(`${INVENTORY_INVALID_PRODUCT_ID}  ${productId}`);
      throw new BadRequestException(`${INVENTORY_INVALID_PRODUCT_ID} ${productId}`);
    }
    return true;
  }
}
