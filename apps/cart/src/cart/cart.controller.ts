import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@salescart/common';
import type { AuthenticatedUser } from '@salescart/common';
import { CartService } from './cart.service';
import { AddCartItemDto, CartResponseDto, SetCartItemQuantityDto } from './dto/cart.dto';

/** Every route acts on the calling user's own cart — there is no userId in the URL or body (E4-1). */
@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOkResponse({ type: CartResponseDto })
  getCart(@CurrentUser() user: AuthenticatedUser): Promise<CartResponseDto> {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  @ApiOkResponse({ description: 'Item added (merged into any existing quantity, capped by stock)' })
  addItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:productId')
  @ApiOkResponse({ description: 'Quantity set (capped by stock; 0 or below removes the item)' })
  setQuantity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: SetCartItemQuantityDto,
  ) {
    return this.cartService.setQuantity(user.id, productId, dto);
  }

  @Delete('items/:productId')
  @ApiOkResponse({ description: 'Item removed' })
  removeItem(@CurrentUser() user: AuthenticatedUser, @Param('productId', ParseIntPipe) productId: number) {
    return this.cartService.removeItem(user.id, productId);
  }

  @Delete()
  @ApiOkResponse({ description: 'Cart cleared' })
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.clear(user.id);
  }
}
