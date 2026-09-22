import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { INVENTORY_INVALID_PRODUCT_ID } from '../constants/inventory.constants';
import {
  InventoryDTO,
  InventoryOrderPlacedOrCancelDTO,
  InventoryUpdateDTO,
  UpdateInventoryByProductIdDTO,
} from '../dto/inventory.dto';
import { ApiBody, ApiOkResponse, ApiQuery } from '@nestjs/swagger';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private readonly logger = new Logger(InventoryController.name);
  @Get()
  @ApiOkResponse({ type: InventoryDTO, isArray: true })
  getFullInventory(): Promise<InventoryDTO[]> {
    this.logger.log('Full Inventory list');
    return this.inventoryService.getFullInventory();
  }

  @Get('bulk-by-product')
  @ApiQuery({ name: 'productIds', required: true, example: '101,102' })
  @ApiOkResponse({ type: InventoryDTO, isArray: true })
  getBulkInventory(@Query('productIds') productIds: string) {
    this.isProductIdValid(productIds);
    return this.inventoryService.getInventoryByProductIds(productIds);
  }

  @Get(':productId')
  @ApiOkResponse({ type: InventoryDTO })
  getInventoryByProduct(
    @Param('productId') productId: number,
  ): Promise<InventoryDTO> | undefined {
    if (this.isProductIdValid(productId)) {
      return this.inventoryService.getInventoryByProductId(productId);
    }
  }

  /**
   * Update stock on order placed
   * @param orderedProducts
   * @returns
   */
  @Patch('update-stock-ordered') // Added a sub-route for clarity
  @ApiBody({ type: InventoryOrderPlacedOrCancelDTO })
  @ApiOkResponse({ description: 'Stock updated successfully' })
  updateInventoryStockByOrder(
    @Body() orderedProducts: InventoryOrderPlacedOrCancelDTO, // Added () to @Body
  ) {
    return this.inventoryService.updateInventoryStockByOrder(orderedProducts);
  }

  /**
   * Update stock on order placed
   * @param cancelledProducts
   * @returns
   */
  @Patch('update-stock-cancelled') // Added a sub-route for clarity
  @ApiBody({ type: InventoryOrderPlacedOrCancelDTO })
  @ApiOkResponse({ description: 'Stock updated successfully' })
  updateInventoryStockByCancel(
    @Body() cancelledProducts: InventoryOrderPlacedOrCancelDTO, // Added () to @Body
  ) {
    return this.inventoryService.updateInventoryStockByCancel(
      cancelledProducts,
    );
  }

  @Patch(':productId')
  @ApiOkResponse({ description: 'Product stuck updated succesfully' })
  updateInventoryByProductId(
    @Param('productId') productId: string,
    @Body() updateInventory: UpdateInventoryByProductIdDTO,
  ) {
    if (this.isProductIdValid(productId)) {
      return this.inventoryService.updateInventoryByProduct(
        productId,
        updateInventory,
      );
    }
  }

  @Post('new-product-inventory')
  @ApiBody({ type: InventoryUpdateDTO })
  @ApiOkResponse({ description: 'Inventory updated succesfully' })
  addNewProductToInventory(@Body() inventory: InventoryUpdateDTO) {
    return this.inventoryService.addNewProductToInventory(inventory);
  }
  /**
   * Product validation check
   * @param productId
   * @returns
   */
  isProductIdValid(productId) {
    const productReg = new RegExp(/^[0-9,]+$/);
    if (!productReg.test(productId)) {
      this.logger.warn(`${INVENTORY_INVALID_PRODUCT_ID}  ${productId}`);
      throw new BadRequestException(
        `${INVENTORY_INVALID_PRODUCT_ID} ${productId}`,
      );
    }
    return true;
  }
}
