import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CART_EMPTY,
  CART_REMOVED_SUCCESFULLY,
  CART_UPDATE_SUCCESFULLY,
  PRODUCT_NOT_AVAILABLE,
} from './constants/cart.constants';
import { CartAddRemoveDTO, CartResponseDto } from './dto/cart.dto';
import { getProductsByIds } from './exteranl/products.client';
import { getInventoryByIds } from './exteranl/inventory.client';
import { CartItem } from './entities/cart-item.entity';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepository: Repository<CartItem>,
  ) {}

  async getCartByUserId(userId: number): Promise<CartItem[]> {
    const cart = await this.cartRepository.findBy({ userId: +userId });
    if (cart.length === 0) {
      this.logger.log(`${CART_EMPTY} for user ${userId}`);
    }
    return cart;
  }

  /**
   * Fetch products in cart by user ID, aggregated with live price and
   * stock from the products and inventory services.
   */
  async getCart(userId: number): Promise<CartResponseDto> {
    const cart = await this.getCartByUserId(userId);

    const productIds = cart.map((i) => i.productId);
    if (productIds.length === 0) {
      return { userId, items: [] };
    }

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

    return { userId, items };
  }

  /**
   * Adding products to cart. Merges into the existing row for this
   * user+product rather than creating a duplicate.
   */
  async addProductToCart(cartAdd: CartAddRemoveDTO): Promise<string> {
    if (!(cartAdd.quantity > 0)) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const existing = await this.cartRepository.findOneBy({
      userId: cartAdd.userId,
      productId: cartAdd.productId,
    });

    if (existing) {
      existing.quantity += cartAdd.quantity;
      await this.cartRepository.save(existing);
    } else {
      await this.cartRepository.save({
        userId: cartAdd.userId,
        productId: cartAdd.productId,
        quantity: cartAdd.quantity,
      });
    }
    return CART_UPDATE_SUCCESFULLY;
  }

  /**
   * Updating the quantity of one product in the cart. Removes the row
   * once the quantity reaches zero or below.
   */
  async updateQuantityByProduct(userId: number, data: CartAddRemoveDTO): Promise<string> {
    const cart = await this.cartRepository.findOneBy({
      userId: +userId,
      productId: data.productId,
    });

    if (!cart) {
      this.logger.warn(`${PRODUCT_NOT_AVAILABLE}`);
      throw new BadRequestException(`${PRODUCT_NOT_AVAILABLE}`);
    }

    cart.quantity += data.quantity;
    if (cart.quantity <= 0) {
      await this.cartRepository.remove(cart);
    } else {
      await this.cartRepository.save(cart);
    }

    return CART_UPDATE_SUCCESFULLY;
  }

  /** Removing all items in the cart for a user. */
  async deleteCartByUserid(userId: number): Promise<string> {
    await this.cartRepository.delete({ userId: +userId });
    return CART_REMOVED_SUCCESFULLY;
  }

  /** Removes one product from the cart and returns what's left for that user. */
  async deleteCartByproductId(userId: number, productId: number): Promise<CartItem[]> {
    await this.cartRepository.delete({ userId: +userId, productId: +productId });
    return this.cartRepository.findBy({ userId: +userId });
  }
}
