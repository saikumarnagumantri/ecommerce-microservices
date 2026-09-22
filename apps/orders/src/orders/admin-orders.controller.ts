import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Role, Roles } from '@salescart/common';
import type { AuthenticatedUser } from '@salescart/common';
import { OrdersService } from './orders.service';
import { AdminOrderQueryDto } from './dto/order-query.dto';
import { DispatchOrderDto } from './dto/dispatch.dto';
import { BulkConfirmDto } from './dto/bulk-confirm.dto';
import { BulkConfirmResultDto, OrderDetailDto, PagedOrdersDto } from './dto/order-response.dto';

@ApiTags('admin/orders')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOkResponse({ type: PagedOrdersDto })
  findAll(@Query() query: AdminOrderQueryDto): Promise<PagedOrdersDto> {
    return this.ordersService.adminList(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderDetailDto })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<OrderDetailDto> {
    return this.ordersService.adminGetDetail(id);
  }

  @Patch(':id/confirm')
  @ApiOkResponse({ type: OrderDetailDto })
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<OrderDetailDto> {
    return this.ordersService.confirm(id, admin.id);
  }

  @Patch('confirm-bulk')
  @ApiOkResponse({ type: BulkConfirmResultDto })
  confirmBulk(
    @Body() dto: BulkConfirmDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<BulkConfirmResultDto> {
    return this.ordersService.confirmBulk(dto.orderIds, admin.id);
  }

  @Post(':id/dispatch')
  @ApiOkResponse({ type: OrderDetailDto })
  dispatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DispatchOrderDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<OrderDetailDto> {
    return this.ordersService.dispatch(id, dto, admin.id);
  }

  @Patch(':id/deliver')
  @ApiOkResponse({ type: OrderDetailDto })
  deliver(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<OrderDetailDto> {
    return this.ordersService.deliver(id, admin.id);
  }

  @Post(':id/cancel')
  @ApiOkResponse({ type: OrderDetailDto })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<OrderDetailDto> {
    return this.ordersService.adminCancel(id, admin.id);
  }
}
