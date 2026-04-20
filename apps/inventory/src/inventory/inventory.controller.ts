import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Put,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { INVENTORY_INVALID_PRODUCT_ID } from 'src/constants/inventory.constants';
import { InventoryDTO, InventoryUpdateDTO } from 'src/dto/inventory.dto';
import { ApiOkResponse } from '@nestjs/swagger';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private readonly logger = new Logger(InventoryController.name);
  @Get()
  @ApiOkResponse({ type: InventoryDTO, isArray: true })
  getFullInventory(): InventoryDTO[] {
    this.logger.log('Full Inventory list');
    return this.inventoryService.getFullInventory();
  }

  @Get(':productId')
  @ApiOkResponse({ type: InventoryDTO, isArray: true })
  getInventoryByproduct(
    @Param('productId') productId: number,
  ): InventoryDTO[] | undefined {
    if (this.isProductIdValid(productId)) {
      return this.inventoryService.getInventoryByProductId(productId);
    }
  }

  @Put(':productId')
  updateInventoryByProductId(
    @Param('productId') productId: number,
    @Body() updateInventory: InventoryUpdateDTO,
  ) {
    if (this.isProductIdValid(productId)) {
        return this.inventoryService.updateInventoryByProduct(productId, updateInventory)
    }
  }

  isProductIdValid(productId) {
    if (typeof productId !== 'number') {
      this.logger.warn(`${INVENTORY_INVALID_PRODUCT_ID}  ${productId}`);
      throw new BadRequestException(
        `${INVENTORY_INVALID_PRODUCT_ID} ${productId}`,
      );
    }
    return true;
  }
}
