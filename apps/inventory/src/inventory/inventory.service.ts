import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  INVENTORY_NOT_FOUND,
  PRODUCT_NOT_FOUND_TO_UPDATE,
  PRODUCT_UPDATED_SUCCESSFULLY,
} from '../constants/inventory.constants';
import {
  InventoryDTO,
  InventoryOrderPlacedOrCancelDTO,
  InventoryUpdateDTO,
  UpdateInventoryByProductIdDTO,
} from '../dto/inventory.dto';
import { Inventory } from '../entities/inventory.entity';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    private readonly dataSource: DataSource,
  ) {}

  private mapToDto(item: { productId: number; stock: number }): InventoryDTO {
    return {
      productId: item.productId,
      stock: item.stock,
      isAvailable: item.stock > 0,
    };
  }

  async getFullInventory(): Promise<InventoryDTO[]> {
    const rows = await this.inventoryRepository.find();
    return rows.map((item) => this.mapToDto(item));
  }

  async getInventoryByProductId(productId: number): Promise<InventoryDTO> {
    const inventory = await this.inventoryRepository.findOneBy({ productId: +productId });
    if (!inventory) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    return this.mapToDto(inventory);
  }

  async getInventoryByProductIds(productIds: string): Promise<InventoryDTO[]> {
    if (!productIds) return [];

    const productArray = productIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');

    const idSet = [...new Set(productArray.map((id) => +id))];
    const rows = await this.inventoryRepository.findBy({ productId: In(idSet) });

    if (rows.length === 0) {
      this.logger.warn(`${INVENTORY_NOT_FOUND} ${productIds}`);
      throw new NotFoundException(`${INVENTORY_NOT_FOUND} ${productIds}`);
    }

    if (productArray.length !== rows.length) {
      this.logger.warn(
        `Missing products: requested ${productArray.length}, found ${rows.length}`,
      );
    }

    return rows.map((p) => this.mapToDto(p));
  }

  async addNewProductToInventory(addInventory: InventoryUpdateDTO): Promise<string> {
    await this.inventoryRepository.save({
      productId: addInventory.productId,
      stock: addInventory.stock,
      isAvailable: addInventory.stock > 0,
    });
    return 'Inventory Updated succesfully';
  }

  async updateInventoryByProduct(
    productId: string,
    updateInventory: UpdateInventoryByProductIdDTO,
  ): Promise<string> {
    const product = await this.inventoryRepository.findOneBy({ productId: +productId });

    if (!product) {
      this.logger.warn(`${PRODUCT_NOT_FOUND_TO_UPDATE} : ${productId}`);
      throw new NotFoundException(`${PRODUCT_NOT_FOUND_TO_UPDATE} : ${productId}`);
    }

    product.stock = updateInventory.stock;
    product.isAvailable = updateInventory.stock > 0;
    await this.inventoryRepository.save(product);
    this.logger.log(
      `${PRODUCT_UPDATED_SUCCESSFULLY} ProductID: ${productId} Payload: ${JSON.stringify(updateInventory)}`,
    );
    return PRODUCT_UPDATED_SUCCESSFULLY;
  }

  /**
   * Reduce stock for every line of a placed order, inside one transaction:
   * every line is checked for sufficient stock before any row is written,
   * and a row lock (SELECT ... FOR UPDATE) keeps two concurrent orders
   * from both reading the same stock and both succeeding. The full
   * concurrency-safe reserve/release design is E3-3; this is the baseline
   * this story needs: a multi-item order can no longer partially apply.
   */
  async updateInventoryStockByOrder(
    orderedProducts: InventoryOrderPlacedOrCancelDTO,
  ): Promise<boolean> {
    const productIds = Object.keys(orderedProducts.items).map(Number);
    if (productIds.length === 0) return true;

    try {
      await this.dataSource.transaction(async (manager) => {
        const rows = await manager
          .createQueryBuilder(Inventory, 'inventory')
          .setLock('pessimistic_write')
          .where('inventory.productId IN (:...productIds)', { productIds })
          .getMany();

        for (const productId of productIds) {
          const row = rows.find((r) => r.productId === productId);
          const order = orderedProducts.items[productId];
          if (!row || row.stock < order.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product ${productId}`,
            );
          }
        }

        for (const row of rows) {
          const order = orderedProducts.items[row.productId];
          row.stock -= order.quantity;
          row.isAvailable = row.stock > 0;
        }
        await manager.save(rows);
      });
      return true;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(err);
      throw new BadRequestException(err instanceof Error ? err.message : err);
    }
  }

  /**
   * Restores stock for every line of a cancelled order, in one transaction.
   */
  async updateInventoryStockByCancel(
    cancelledProducts: InventoryOrderPlacedOrCancelDTO,
  ): Promise<boolean> {
    const productIds = Object.keys(cancelledProducts.items).map(Number);
    if (productIds.length === 0) return true;

    try {
      await this.dataSource.transaction(async (manager) => {
        const rows = await manager
          .createQueryBuilder(Inventory, 'inventory')
          .setLock('pessimistic_write')
          .where('inventory.productId IN (:...productIds)', { productIds })
          .getMany();

        for (const row of rows) {
          const order = cancelledProducts.items[row.productId];
          if (order) {
            row.stock += order.quantity;
            row.isAvailable = row.stock > 0;
          }
        }
        await manager.save(rows);
      });
      return true;
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException(err instanceof Error ? err.message : err);
    }
  }
}
