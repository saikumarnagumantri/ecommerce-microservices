import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { INVENTORY_NOT_FOUND } from 'src/constants/inventory.constants';
import { INVENTORY } from 'src/data/inventory.data';
import {
  InventoryDTO,
  InventoryOrderPlacedOrCancelDTO,
  InventoryUpdateDTO,
} from 'src/dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  /**
   * Fetch all products
   * @returns
   */
  getFullInventory() {
    return INVENTORY;
  }

  /**
   * Fetch product by productId
   * @param productId
   * @returns
   */
  getInventoryByProductId(productId: number): InventoryDTO[] | undefined {
    console.log('Here');
    const inventory = INVENTORY.filter((inv) => inv.productId === +productId);

    if (!inventory) {
      throw new NotFoundException(`${INVENTORY_NOT_FOUND} ${productId}`);
    }
    return inventory;
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

    return products;
  }

  addNewProductToInventory(addInventory: InventoryUpdateDTO) {
    INVENTORY.push(addInventory);
    return 'Inventory Updated succesfully';
  }
  /**
   * Updating the product inventory by product Id
   * @param productId
   * @param updateInventory
   * @returns
   */
  updateInventoryByProduct(
    productId: number,
    updateInventory: InventoryUpdateDTO,
  ) {
    return INVENTORY.map((inv) =>
      inv.productId === productId ? updateInventory : inv,
    );
  }

  /**
   * Reduce the product quantity after order placed
   * @param orderedProducts
   * @returns
   */
  updateInventoryStockByOrder(
    orderedProducts: InventoryOrderPlacedOrCancelDTO,
  ) {
    console.log(INVENTORY, orderedProducts);
    try {
      INVENTORY.map((inv) => {
        // 1. Get the specific order for this product
        const order = orderedProducts.items[inv.productId];

        if (order) {
          // 2. Access quantity from the specific order object
          inv.inStock -= order.quantity;

          // 3. Simplified boolean logic
          inv.isOutOfStock = inv.inStock <= 0;
        }
        return inv;
      });

      console.log(INVENTORY, 'INVENTORY');
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
          inv.inStock += order.quantity;
        }
        return inv;
      });
      return true;
    } catch (err) {
      throw new BadRequestException(err);
    }
  }
}
