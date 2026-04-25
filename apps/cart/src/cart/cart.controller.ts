import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { ApiOkResponse } from '@nestjs/swagger';
import { CartAddRemoveDTO, CartDTO, CartResponseDto } from './dto/cart.dto';
import {
  INVALID_PRODUCT_ID,
  INVALID_USER_ID,
} from './constants/cart.constants';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}
  private readonly logger = new Logger(CartController.name);

  @Get(':userId')
  @ApiOkResponse({ type: CartResponseDto })
  async getCartByUserId(
    @Param('userId') userId: number,
  ): Promise<CartResponseDto> {
    if (isNaN(userId)) {
      this.logger.warn(`${INVALID_PRODUCT_ID} ${userId}`);
      throw new BadRequestException(`${INVALID_PRODUCT_ID} ${userId}`);
    }
    return await this.cartService.getCart(userId);
  }

  @Post()
  @ApiOkResponse({ description: 'Product added to cart' })
  addProductToCart(@Body() cartAdd: CartAddRemoveDTO): string {
    return this.cartService.addProductToCart(cartAdd);
  }

  @Patch('updateQuantityByProduct/:userId')
  @ApiOkResponse({ description: 'Product in cart Updated succesfully' })
  updateQuantityByProduct(
    @Param('userId') userId: number,
    @Body() data: CartAddRemoveDTO,
  ) {
    if (isNaN(userId)) {
      this.logger.warn(`${INVALID_USER_ID} ${userId}`);
      throw new BadRequestException(`${INVALID_USER_ID} ${userId}`);
    }
    return this.cartService.updateQuantityByProduct(userId, data);
  }

  @Delete('deleteCartByUserid/:userId')
  @ApiOkResponse({ description: 'Cart Delete succesfully' })
  deleteCartByUserid(@Param('userId') userId: number) {
    if (isNaN(userId)) {
      this.logger.warn(`${INVALID_PRODUCT_ID} ${userId}`);
      throw new BadRequestException(`${INVALID_PRODUCT_ID} ${userId}`);
    }
    this.cartService.deleteCartByUserid(userId);
  }

  @Delete('deleteCartByproductId/:userId/:productId')
  @ApiOkResponse({ description: 'Cart Delete succesfully' })
  deleteCartByproductId(
    @Param('userId') userId: number,
    @Param('productId') productId: number,
  ) {
    if (isNaN(userId)) {
      this.logger.warn(`${INVALID_USER_ID} ${userId}`);
      throw new BadRequestException(`${INVALID_USER_ID} ${userId}`);
    }
    if (isNaN(productId)) {
      this.logger.warn(`${INVALID_PRODUCT_ID} ${productId}`);
      throw new BadRequestException(`${INVALID_PRODUCT_ID} ${productId}`);
    }
    return this.cartService.deleteCartByproductId(userId, productId);
  }
}
