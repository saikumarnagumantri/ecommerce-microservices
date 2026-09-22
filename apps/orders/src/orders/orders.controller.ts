import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PaginationQueryDto } from '@salescart/common';
import type { AuthenticatedUser } from '@salescart/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderDetailDto, PagedOrdersDto } from './dto/order-response.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOkResponse({ type: OrderDetailDto })
  placeOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
    @Headers('authorization') authHeader: string,
  ): Promise<OrderDetailDto> {
    return this.ordersService.placeOrder(user.id, dto, authHeader);
  }

  @Get()
  @ApiOkResponse({ type: PagedOrdersDto })
  getOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PagedOrdersDto> {
    return this.ordersService.getOrdersForUser(user.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderDetailDto })
  getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrderDetailDto> {
    return this.ordersService.getOrderDetailForUser(user.id, id);
  }

  @Post(':id/cancel')
  @ApiOkResponse({ type: OrderDetailDto })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrderDetailDto> {
    return this.ordersService.cancelForUser(user.id, id);
  }
}
