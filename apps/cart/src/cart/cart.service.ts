import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CART_EMPTY, CART_REMOVED_SUCCESFULLY, CART_UPDATE_SUCCESFULLY, PRODUCT_NOT_AVAILABLE } from './constants/cart.constants';
import { AddCartItemDto, CartResponseDto, SetCartItemQuantityDto } from './dto/cart.dto';
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

  /** Fetch the cart aggregated with live price and stock from products/inventory. */
  async getCart(userId: number): Promise<CartResponseDto> {
    const cart = await this.getCartByUserId(userId);

    const productIds = cart.map((i) => i.productId);
    if (productIds.length === 0) {
      return { userId, items: [], total: 0 };
    }

    const results = await Promise.allSettled([getProductsByIds(productIds), getInventoryByIds(productIds)]);
    if (results[0].status === 'rejected') this.logger.error('Products service failed');
    if (results[1].status === 'rejected') this.logger.error('Inventory service failed');
    const products = results[0].status === 'fulfilled' ? results[0].value : [];
    const inventory = results[1].status === 'fulfilled' ? results[1].value : [];

    const items = cart.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const stock = inventory.find((i) => i.productId === item.productId);
      const price = product?.discountPrice ?? product?.originalPrice ?? 0;

      return {
        productId: item.productId,
        quantity: item.quantity,
        name: product?.name ?? 'Unavailable',
        price,
        subtotal: price * item.quantity,
        isAvailable: stock?.isAvailable ?? false,
        // Reflects a write-time cap, not a live check — see addItem/setQuantity.
        wasCapped: false,
      };
    });

    return { userId, items, total: items.reduce((sum, i) => sum + i.subtotal, 0) };
  }

  /** How much of `productId` is available right now, or null if inventory couldn't be reached (fails open: no cap applied). */
  private async availableStock(productId: number): Promise<number | null> {
    try {
      const [snapshot] = await getInventoryByIds([productId]);
      return snapshot ? snapshot.stock : null;
    } catch (err) {
      this.logger.error(`Could not read stock for product ${productId}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /**
   * Adds to the cart, merging into any existing quantity for this
   * product. The resulting quantity is capped at the product's current
   * stock (E4-2) — if inventory can't be reached, the request goes
   * through uncapped rather than blocking checkout on it.
   */
  async addItem(userId: number, dto: AddCartItemDto): Promise<{ quantity: number; wasCapped: boolean }> {
    const existing = await this.cartRepository.findOneBy({ userId, productId: dto.productId });
    const requested = (existing?.quantity ?? 0) + dto.quantity;

    const stock = await this.availableStock(dto.productId);
    const capped = stock !== null && requested > stock;
    const finalQuantity = capped ? stock! : requested;

    if (existing) {
      existing.quantity = finalQuantity;
      await this.cartRepository.save(existing);
    } else if (finalQuantity > 0) {
      await this.cartRepository.save({ userId, productId: dto.productId, quantity: finalQuantity });
    }

    return { quantity: finalQuantity, wasCapped: capped };
  }

  /** Sets a line's quantity outright (e.g. a quantity stepper); 0 or below removes it. Also capped by stock. */
  async setQuantity(
    userId: number,
    productId: number,
    dto: SetCartItemQuantityDto,
  ): Promise<{ quantity: number; wasCapped: boolean }> {
    const existing = await this.cartRepository.findOneBy({ userId, productId });
    if (!existing) {
      this.logger.warn(`${PRODUCT_NOT_AVAILABLE}`);
      throw new BadRequestException(`${PRODUCT_NOT_AVAILABLE}`);
    }

    if (dto.quantity <= 0) {
      await this.cartRepository.remove(existing);
      return { quantity: 0, wasCapped: false };
    }

    const stock = await this.availableStock(productId);
    const capped = stock !== null && dto.quantity > stock;
    existing.quantity = capped ? stock! : dto.quantity;
    await this.cartRepository.save(existing);

    return { quantity: existing.quantity, wasCapped: capped };
  }

  async clear(userId: number): Promise<string> {
    await this.cartRepository.delete({ userId });
    return CART_REMOVED_SUCCESFULLY;
  }

  async removeItem(userId: number, productId: number): Promise<string> {
    await this.cartRepository.delete({ userId, productId });
    return CART_UPDATE_SUCCESFULLY;
  }
}
