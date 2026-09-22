import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { ADDRESS_NOT_FOUND } from '../constants/users.constants';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  list(userId: number): Promise<Address[]> {
    return this.addressRepository.findBy({ userId });
  }

  private async clearOtherDefaults(userId: number, exceptId?: number): Promise<void> {
    const others = await this.addressRepository.findBy({ userId });
    const toClear = others.filter((a) => a.isDefault && a.id !== exceptId);
    if (toClear.length > 0) {
      await this.addressRepository.save(toClear.map((a) => ({ ...a, isDefault: false })));
    }
  }

  async create(userId: number, dto: CreateAddressDto): Promise<Address> {
    const existingCount = await this.addressRepository.countBy({ userId });
    // The user's very first address is always their default, regardless
    // of what was sent, so there's never a moment with zero defaults.
    const isDefault = existingCount === 0 ? true : Boolean(dto.isDefault);

    const saved = await this.addressRepository.save({
      userId,
      line1: dto.line1,
      line2: dto.line2 ?? null,
      city: dto.city,
      state: dto.state,
      postalCode: dto.postalCode,
      country: dto.country,
      isDefault,
    });

    if (isDefault) {
      await this.clearOtherDefaults(userId, saved.id);
    }
    return saved;
  }

  /** Public wrapper: lets other flows (order placement) resolve one address by id, still ownership-checked. */
  getOne(userId: number, addressId: number): Promise<Address> {
    return this.findOwned(userId, addressId);
  }

  private async findOwned(userId: number, addressId: number): Promise<Address> {
    const address = await this.addressRepository.findOneBy({ id: addressId, userId });
    if (!address) {
      throw new NotFoundException(ADDRESS_NOT_FOUND);
    }
    return address;
  }

  async update(userId: number, addressId: number, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.findOwned(userId, addressId);

    Object.assign(address, {
      ...(dto.line1 !== undefined && { line1: dto.line1 }),
      ...(dto.line2 !== undefined && { line2: dto.line2 }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
      ...(dto.country !== undefined && { country: dto.country }),
    });

    if (dto.isDefault === true) {
      address.isDefault = true;
    }
    await this.addressRepository.save(address);

    if (address.isDefault) {
      await this.clearOtherDefaults(userId, address.id);
    }
    return address;
  }

  async remove(userId: number, addressId: number): Promise<void> {
    const address = await this.findOwned(userId, addressId);
    await this.addressRepository.remove(address);

    if (address.isDefault) {
      // Keep the invariant "exactly one default while any address
      // exists" by promoting whichever one is left.
      const remaining = await this.addressRepository.findBy({ userId });
      if (remaining.length > 0) {
        remaining[0].isDefault = true;
        await this.addressRepository.save(remaining[0]);
      }
    }
  }
}
