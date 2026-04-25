import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CARTDATA } from './data/cart.data';
import {
  CART_EMPTY,
  CART_REMOVED_SUCCESFULLY,
  CART_UPDATE_SUCCESFULLY,
  PRODUCT_NOT_AVAILABLE,
} from './constants/cart.constants';
import { CartAddRemoveDTO, CartDTO, CartResponseDto } from './dto/cart.dto';
import { getProductsByIds } from './exteranl/products.client';
import { getInventoryByIds } from './exteranl/inventory.client';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  getCartByUserId(userId: number) {
    const cart = CARTDATA.filter((cart) => cart.userId === +userId);
    if (cart.length === 0) {
      this.logger.error(`${CART_EMPTY}`);
    }

    const productIds = cart.map((prodt) => prodt.productId);
    console.log(productIds);

    return cart;
  }
  /**
   * Fetch Products in cart by user ID
   * @param userId
   * @returns
   */
  async getCart(userId: number): Promise<CartResponseDto> {
    const cart = this.getCartByUserId(userId); // your existing method

    const productIds = cart.map((i) => i.productId);

    // 🔥 Parallel calls
    const results = await Promise.allSettled([
      getProductsByIds(productIds),
      getInventoryByIds(productIds),
    ]);
    if (results[0].status === 'rejected') {
      this.logger.error('Products service failed');
    }

    if (results[1].status === 'rejected') {
      this.logger.error('Inventory service failed');
    }
    const products = results[0].status === 'fulfilled' ? results[0].value : [];
    const inventory = results[1].status === 'fulfilled' ? results[1].value : [];

    // 🔗 Merge
    const items = cart.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const stock = inventory.find((i) => i.productId === item.productId);

      return {
        productId: item.productId,
        quantity: item.quantity,
        name: product?.name ?? 'Unavailable',
        price: product?.discountPrice ?? product?.originalPrice ?? 0,
        isAvailable: stock?.isAvailable ?? false,
      };
    });

    return {
      userId,
      items,
    };
  }

  /**
   * Adding products to cart
   * @param cartAdd
   * @returns
   */
  addProductToCart(cartAdd: CartAddRemoveDTO): string {
    try {
      CARTDATA.push({
        userId: cartAdd.userId,
        productId: cartAdd.productId,
        quantity: cartAdd.quantity,
      });
      return `${CART_UPDATE_SUCCESFULLY}`;
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException(err);
    }
  }

  /**
   * Updating products in cart
   * @param userId
   * @param data
   * @returns
   */
  updateQuantityByProduct(userId: number, data: CartAddRemoveDTO): string {
    const cart = CARTDATA.find(
      (cart) =>
        cart.userId === data.userId && cart?.productId === data.productId,
    );

    if (!cart) {
      this.logger.warn(`${PRODUCT_NOT_AVAILABLE}`);
      throw new BadRequestException(`${PRODUCT_NOT_AVAILABLE}`);
    }

    cart.quantity += data.quantity;
    if (cart.quantity === 0) {
      CARTDATA.filter(
        (cart) =>
          cart.userId === data.userId && cart?.productId !== data.productId,
      );
    }
    console.log(cart, CARTDATA);

    return CART_UPDATE_SUCCESFULLY;
  }

  /**
   * Removing all items in cart
   * @param userId
   * @returns
   */
  deleteCartByUserid(userId: number): string {
    let cart = CARTDATA.filter((cart) => cart.userId !== userId);

    cart.length = 0;

    return CART_REMOVED_SUCCESFULLY;
  }

  /**
   *
   * @param userId
   * @param productId
   * @returns
   */
  deleteCartByproductId(userId, productId): CartDTO[] | [] {
    return CARTDATA.filter(
      (cart) => cart.userId === +userId && cart.productId !== +productId,
    );
  }
}
