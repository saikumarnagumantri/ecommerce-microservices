import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryService } from './inventory.service';
import { Inventory } from '../entities/inventory.entity';

type MockRepo = Partial<Record<keyof Repository<Inventory>, jest.Mock>>;

/** Fakes DataSource.transaction: runs the callback against an in-memory row set via a manager stub. */
function fakeDataSource(rows: Inventory[]) {
  const manager = {
    createQueryBuilder: () => ({
      setLock: () => ({
        where: () => ({
          getMany: async () => rows.map((r) => ({ ...r })),
        }),
      }),
    }),
    save: jest.fn(async (saved: Inventory[]) => {
      for (const s of saved) {
        const row = rows.find((r) => r.productId === s.productId);
        if (row) Object.assign(row, s);
      }
      return saved;
    }),
  };
  return {
    transaction: jest.fn((cb: (manager: typeof manager) => Promise<void>) => cb(manager)),
  } as unknown as DataSource;
}

describe('InventoryService', () => {
  let service: InventoryService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findBy: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Inventory), useValue: repo },
        { provide: DataSource, useValue: fakeDataSource([]) },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getInventoryByProductId throws NotFoundException when missing', async () => {
    repo.findOneBy!.mockResolvedValue(null);
    await expect(service.getInventoryByProductId(999)).rejects.toThrow(NotFoundException);
  });

  it('getInventoryByProductId maps stock > 0 to isAvailable true', async () => {
    repo.findOneBy!.mockResolvedValue({ productId: 101, stock: 5, isAvailable: true });
    await expect(service.getInventoryByProductId(101)).resolves.toEqual({
      productId: 101,
      stock: 5,
      isAvailable: true,
    });
  });

  describe('updateInventoryStockByOrder', () => {
    it('applies every line when all have sufficient stock', async () => {
      const rows: Inventory[] = [
        { productId: 101, stock: 20, isAvailable: true },
        { productId: 202, stock: 30, isAvailable: true },
      ];
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InventoryService,
          { provide: getRepositoryToken(Inventory), useValue: repo },
          { provide: DataSource, useValue: fakeDataSource(rows) },
        ],
      }).compile();
      const svc = module.get<InventoryService>(InventoryService);

      await expect(
        svc.updateInventoryStockByOrder({ items: { 101: { quantity: 5 }, 202: { quantity: 3 } } }),
      ).resolves.toBe(true);
      expect(rows.find((r) => r.productId === 101)!.stock).toBe(15);
      expect(rows.find((r) => r.productId === 202)!.stock).toBe(27);
    });

    it('leaves every row untouched when any single line has insufficient stock', async () => {
      const rows: Inventory[] = [
        { productId: 101, stock: 20, isAvailable: true },
        { productId: 202, stock: 30, isAvailable: true },
      ];
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InventoryService,
          { provide: getRepositoryToken(Inventory), useValue: repo },
          { provide: DataSource, useValue: fakeDataSource(rows) },
        ],
      }).compile();
      const svc = module.get<InventoryService>(InventoryService);

      await expect(
        svc.updateInventoryStockByOrder({
          items: { 101: { quantity: 5 }, 202: { quantity: 9999 } },
        }),
      ).rejects.toThrow(BadRequestException);

      // The whole batch must be all-or-nothing: 101 had enough stock on
      // its own, but must not be decremented because 202 in the same
      // order did not.
      expect(rows.find((r) => r.productId === 101)!.stock).toBe(20);
      expect(rows.find((r) => r.productId === 202)!.stock).toBe(30);
    });
  });
});
