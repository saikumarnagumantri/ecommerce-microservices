import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual, Repository } from 'typeorm';
import {
  INVENTORY_NOT_FOUND,
  PRODUCT_NOT_FOUND_TO_UPDATE,
  PRODUCT_UPDATED_SUCCESSFULLY,
} from '../constants/inventory.constants';
import {
  AdjustStockDto,
  InventoryDTO,
  InventoryOrderPlacedOrCancelDTO,
  InventoryUpdateDTO,
  RestockDto,
  UpdateInventoryByProductIdDTO,
} from '../dto/inventory.dto';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement, MovementReason } from '../entities/inventory-movement.entity';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const NEGATIVE_STOCK_REJECTED = 'This change would take stock below zero';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepository: Repository<InventoryMovement>,
    private readonly dataSource: DataSource,
  ) {}

  private mapToDto(item: { productId: number; stock: number }): InventoryDTO {
    return {
      productId: item.productId,
      stock: item.stock,
      isAvailable: item.stock > 0,
    };
  }

  /** DTO-level validation can't reach into a Record's values (see inventory.dto.ts) — checked here instead. */
  private assertValidLines(items: InventoryOrderPlacedOrCancelDTO['items']): void {
    for (const [productId, line] of Object.entries(items)) {
      if (!Number.isInteger(line?.quantity) || line.quantity < 1) {
        throw new BadRequestException(
          `Invalid quantity for product ${productId}: must be a positive integer`,
        );
      }
    }
  }

  private recordMovement(
    manager: EntityManager,
    productId: number,
    delta: number,
    reason: MovementReason,
    refId?: string | null,
  ): Promise<InventoryMovement> {
    return manager.save(InventoryMovement, { productId, delta, reason, refId: refId ?? null });
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

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
      this.logger.warn(`Missing products: requested ${productArray.length}, found ${rows.length}`);
    }
    return rows.map((p) => this.mapToDto(p));
  }

  /** E3-4: products at or below the threshold, lowest stock first. */
  async getLowStock(threshold = DEFAULT_LOW_STOCK_THRESHOLD): Promise<InventoryDTO[]> {
    const rows = await this.inventoryRepository.find({
      where: { stock: LessThanOrEqual(threshold) },
      order: { stock: 'ASC' },
    });
    return rows.map((r) => this.mapToDto(r));
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  async addNewProductToInventory(addInventory: InventoryUpdateDTO): Promise<string> {
    await this.dataSource.transaction(async (manager) => {
      await manager.save(Inventory, {
        productId: addInventory.productId,
        stock: addInventory.stock,
        isAvailable: addInventory.stock > 0,
      });
      await this.recordMovement(manager, addInventory.productId, addInventory.stock, MovementReason.RESTOCK);
    });
    return 'Inventory Updated succesfully';
  }

  /** Admin: set stock to an exact value (e.g. correcting after a stocktake). */
  async updateInventoryByProduct(
    productId: string,
    updateInventory: UpdateInventoryByProductIdDTO,
  ): Promise<string> {
    await this.dataSource.transaction(async (manager) => {
      const product = await manager.findOneBy(Inventory, { productId: +productId });
      if (!product) {
        this.logger.warn(`${PRODUCT_NOT_FOUND_TO_UPDATE} : ${productId}`);
        throw new NotFoundException(`${PRODUCT_NOT_FOUND_TO_UPDATE} : ${productId}`);
      }

      const delta = updateInventory.stock - product.stock;
      product.stock = updateInventory.stock;
      product.isAvailable = updateInventory.stock > 0;
      await manager.save(product);
      if (delta !== 0) {
        await this.recordMovement(manager, +productId, delta, MovementReason.ADJUST);
      }
    });

    this.logger.log(
      `${PRODUCT_UPDATED_SUCCESSFULLY} ProductID: ${productId} Payload: ${JSON.stringify(updateInventory)}`,
    );
    return PRODUCT_UPDATED_SUCCESSFULLY;
  }

  /** Admin: add stock (e.g. a new delivery arrived). */
  async restock(productId: number, dto: RestockDto): Promise<InventoryDTO> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOneBy(Inventory, { productId });
      if (!product) {
        throw new NotFoundException(`Product ${productId} not found`);
      }
      product.stock += dto.quantity;
      product.isAvailable = product.stock > 0;
      await manager.save(product);
      await this.recordMovement(manager, productId, dto.quantity, MovementReason.RESTOCK);
      return this.mapToDto(product);
    });
  }

  /** Admin: apply a signed correction (e.g. -3 for shrinkage). Cannot take stock below zero. */
  async adjustStock(productId: number, dto: AdjustStockDto): Promise<InventoryDTO> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOneBy(Inventory, { productId });
      if (!product) {
        throw new NotFoundException(`Product ${productId} not found`);
      }
      const newStock = product.stock + dto.delta;
      if (newStock < 0) {
        throw new BadRequestException(NEGATIVE_STOCK_REJECTED);
      }
      product.stock = newStock;
      product.isAvailable = newStock > 0;
      await manager.save(product);
      await this.recordMovement(manager, productId, dto.delta, MovementReason.ADJUST);
      return this.mapToDto(product);
    });
  }

  /**
   * Reduce stock for every line of a placed order, inside one transaction:
   * every line is checked for sufficient stock before any row is written,
   * and a row lock (SELECT ... FOR UPDATE) keeps two concurrent orders
   * from both reading the same stock and both succeeding.
   */
  async updateInventoryStockByOrder(orderedProducts: InventoryOrderPlacedOrCancelDTO): Promise<boolean> {
    const productIds = Object.keys(orderedProducts.items).map(Number);
    if (productIds.length === 0) return true;
    this.assertValidLines(orderedProducts.items);

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
            throw new BadRequestException(`Insufficient stock for product ${productId}`);
          }
        }

        for (const row of rows) {
          const order = orderedProducts.items[row.productId];
          row.stock -= order.quantity;
          row.isAvailable = row.stock > 0;
          await this.recordMovement(manager, row.productId, -order.quantity, MovementReason.ORDER, orderedProducts.refId);
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

  /** Restores stock for every line of a cancelled order, in one transaction. */
  async updateInventoryStockByCancel(cancelledProducts: InventoryOrderPlacedOrCancelDTO): Promise<boolean> {
    const productIds = Object.keys(cancelledProducts.items).map(Number);
    if (productIds.length === 0) return true;
    this.assertValidLines(cancelledProducts.items);

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
            await this.recordMovement(manager, row.productId, order.quantity, MovementReason.CANCEL, cancelledProducts.refId);
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
