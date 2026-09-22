import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@salescart/common';
import type { AuthenticatedUser } from '@salescart/common';
import { UsersService } from './users.service';
import { AddressesService } from './addresses.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { Address } from './entities/address.entity';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly addressesService: AddressesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: UserProfileDto })
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    return this.usersService.findById(user.id);
  }

  @Patch()
  @ApiOkResponse({ type: UserProfileDto })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('addresses')
  @ApiOkResponse({ type: Address, isArray: true })
  listAddresses(@CurrentUser() user: AuthenticatedUser): Promise<Address[]> {
    return this.addressesService.list(user.id);
  }

  @Get('addresses/:id')
  @ApiOkResponse({ type: Address })
  getAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Address> {
    return this.addressesService.getOne(user.id, id);
  }

  @Post('addresses')
  @ApiOkResponse({ type: Address })
  addAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ): Promise<Address> {
    return this.addressesService.create(user.id, dto);
  }

  @Patch('addresses/:id')
  @ApiOkResponse({ type: Address })
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ): Promise<Address> {
    return this.addressesService.update(user.id, id, dto);
  }

  @Delete('addresses/:id')
  @ApiOkResponse({ description: 'Address deleted' })
  removeAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.addressesService.remove(user.id, id);
  }
}
