import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddressesService } from './addresses.service';
import { Address } from './entities/address.entity';

type MockRepo = Partial<Record<keyof Repository<Address>, jest.Mock>>;

describe('AddressesService', () => {
  let service: AddressesService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = {
      findBy: jest.fn().mockResolvedValue([]),
      countBy: jest.fn().mockResolvedValue(0),
      save: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressesService, { provide: getRepositoryToken(Address), useValue: repo }],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
  });

  it('makes the first address default regardless of what was requested', async () => {
    repo.countBy!.mockResolvedValue(0);
    repo.save!.mockImplementation(async (a) => ({ id: 1, ...a }));

    const result = await service.create(1, {
      line1: 'L1', city: 'C', state: 'S', postalCode: 'P', country: 'IN', isDefault: false,
    });

    expect(result.isDefault).toBe(true);
  });

  it('clears other defaults when a new address is marked default', async () => {
    repo.countBy!.mockResolvedValue(1);
    repo.save!.mockImplementation(async (a) => (Array.isArray(a) ? a : { id: 2, ...a }));
    repo.findBy!.mockResolvedValue([{ id: 1, userId: 1, isDefault: true }]);

    await service.create(1, {
      line1: 'L1', city: 'C', state: 'S', postalCode: 'P', country: 'IN', isDefault: true,
    });

    expect(repo.save).toHaveBeenCalledWith([expect.objectContaining({ id: 1, isDefault: false })]);
  });

  it('rejects updating an address that is not owned by this user', async () => {
    repo.findOneBy!.mockResolvedValue(null);
    await expect(service.update(1, 999, { city: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('promotes another address to default when the default one is deleted', async () => {
    repo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, isDefault: true });
    repo.findBy!.mockResolvedValue([{ id: 2, userId: 1, isDefault: false }]);

    await service.remove(1, 1);

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 2, isDefault: true }));
  });
});
