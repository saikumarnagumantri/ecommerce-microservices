import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  INVENTORY_NOT_FOUND,
  PRODUCT_NOT_FOUND_TO_UPDATE,
  PRODUCT_UPDATED_SUCCESSFULLY,
} from 'src/constants/inventory.constants';
import { INVENTORY } from 'src/data/inventory.data';
import {
  InventoryDTO,
  InventoryOrderPlacedOrCancelDTO,
  InventoryUpdateDTO,
  UpdateInventoryByProductIdDTO,
} from 'src/dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  private mapToDto(item: any): InventoryDTO {
    return {
      productId: item.productId,
      stock: item.inStock,
      isAvailable: item.inStock > 0,
    };
  }
  /**
   * Fetch all products
   * @returns
   */
  getFullInventory() {
    return INVENTORY.map((item) => this.mapToDto(item));
  }

  /**
   * Fetch product by productId
   * @param productId
   * @returns
   */
  getInventoryByProductId(productId: number): InventoryDTO | undefined {
    const inventory = INVENTORY.filter((inv) => inv.productId === +productId);

    if (!inventory[0]) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    return this.mapToDto(inventory[0]);
  }

  /**
   *
   * @param productIds Products as string ex: 101,202, 303
   * @returns InventoryDTO[] returns products matches to productIds
   */
  getInventoryByProductIds(productIds: string): InventoryDTO[] | undefined {
    if (!productIds) return [];

    // 1. Clean and parse the input
    // split by comma and optional whitespace, then filter out empty values
    const productArray = productIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');

    // 2. Performance optimization: Use a Set for O(1) lookups
    const idSet = new Set(productArray);

    // 3. Filter inventory ensuring type consistency
    const products = INVENTORY.filter((inv) =>
      idSet.has(inv.productId.toString()),
    );

    // 4. Error Handling
    // Note: .filter() always returns an array, even if empty.
    if (products.length === 0) {
      this.logger.warn(`${INVENTORY_NOT_FOUND} ${productIds}`);
      throw new NotFoundException(`${INVENTORY_NOT_FOUND} ${productIds}`);
    }

    if (productArray.length !== products.length) {
      this.logger.warn(
        `Missing products: requested ${productArray.length}, found ${products.length}`,
      );
    }

    return products.map((p) => this.mapToDto(p));
  }

  addNewProductToInventory(addInventory: InventoryUpdateDTO) {
    INVENTORY.push({
      productId: addInventory.productId,
      stock: addInventory.stock,
      isAvailable: addInventory.stock <= 0,
    });
    return 'Inventory Updated succesfully';
  }
  /**
   * Updating the product inventory by product Id
   * @param productId
   * @param updateInventory
   * @returns
   */
  updateInventoryByProduct(
    productId: string,
    updateInventory: UpdateInventoryByProductIdDTO,
  ) {
    try {
      // 1. Find the reference to the object
      const product = INVENTORY.find((inv) => inv.productId === +productId);

      if (product) {
        // 2. Updating this 'product' variable updates the item inside INVENTORY
        product.stock = updateInventory.stock;
        product.isAvailable =
          updateInventory.stock > 0 || updateInventory.isAvailable;
        this.logger.log(
          `${PRODUCT_UPDATED_SUCCESSFULLY} ProductID: ${productId} Payload: ${JSON.stringify(updateInventory)}`,
        );
        return `${PRODUCT_UPDATED_SUCCESSFULLY}`;
      } else {
        this.logger.warn(`${PRODUCT_NOT_FOUND_TO_UPDATE} : ${productId}`);
        throw new NotFoundException(
          `${PRODUCT_NOT_FOUND_TO_UPDATE} : ${productId}`,
        );
      }
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException(err);
    }
  }

  /**
   * Reduce the product quantity after order placed
   * @param orderedProducts
   * @returns
   */
  updateInventoryStockByOrder(
    orderedProducts: InventoryOrderPlacedOrCancelDTO,
  ) {
    try {
      INVENTORY.map((inv) => {
        // 1. Get the specific order for this product
        const order = orderedProducts.items[inv.productId];

        if (order) {
          // 2. Access quantity from the specific order object
          inv.stock -= order.quantity;

          // 3. Simplified boolean logic
          inv.isAvailable = inv.stock <= 0;
        }
        return inv;
      });

      return true;
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  /**
   * Increase the product quantity after order placed
   * @param orderedProducts
   * @returns
   */
  updateInventoryStockByCancel(
    cancelledProducts: InventoryOrderPlacedOrCancelDTO,
  ): Boolean {
    try {
      INVENTORY.map((inv) => {
        // 1. Get the specific order for this product
        const order = cancelledProducts.items[inv.productId];
        if (order) {
          // 2. Access quantity from the specific order object
          inv.stock += order.quantity;
        }
        return inv;
      });
      return true;
    } catch (err) {
      throw new BadRequestException(err);
    }
  }
}
