import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';
import * as inventoryClient from './exteranl/inventory.client';

jest.mock('./exteranl/products.client', () => ({ getProductsByIds: jest.fn().mockResolvedValue([]) }));
jest.mock('./exteranl/inventory.client');

type MockRepo = Partial<Record<keyof Repository<CartItem>, jest.Mock>>;

describe('CartService', () => {
  let service: CartService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = {
      findBy: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
    };
    (inventoryClient.getInventoryByIds as jest.Mock).mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CartService, { provide: getRepositoryToken(CartItem), useValue: repo }],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getCart returns an empty, zero-total cart without calling other services when empty', async () => {
    repo.findBy!.mockResolvedValue([]);
    await expect(service.getCart(1)).resolves.toEqual({ userId: 1, items: [], total: 0 });
  });

  describe('addItem', () => {
    it('creates a new row when none exists yet', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      (inventoryClient.getInventoryByIds as jest.Mock).mockResolvedValue([{ productId: 101, stock: 50, isAvailable: true }]);

      const result = await service.addItem(1, { productId: 101, quantity: 3 });

      expect(result).toEqual({ quantity: 3, wasCapped: false });
      expect(repo.save).toHaveBeenCalledWith({ userId: 1, productId: 101, quantity: 3 });
    });

    it('merges into an existing row', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, productId: 101, quantity: 2 });
      (inventoryClient.getInventoryByIds as jest.Mock).mockResolvedValue([{ productId: 101, stock: 50, isAvailable: true }]);

      const result = await service.addItem(1, { productId: 101, quantity: 3 });

      expect(result.quantity).toBe(5);
    });

    it('caps the quantity at available stock', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, productId: 101, quantity: 8 });
      (inventoryClient.getInventoryByIds as jest.Mock).mockResolvedValue([{ productId: 101, stock: 10, isAvailable: true }]);

      const result = await service.addItem(1, { productId: 101, quantity: 5 }); // 8+5=13, but only 10 in stock

      expect(result).toEqual({ quantity: 10, wasCapped: true });
    });

    it('does not cap when inventory cannot be reached (fails open)', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      (inventoryClient.getInventoryByIds as jest.Mock).mockRejectedValue(new Error('down'));

      const result = await service.addItem(1, { productId: 101, quantity: 100 });

      expect(result).toEqual({ quantity: 100, wasCapped: false });
    });
  });

  describe('setQuantity', () => {
    it('throws when the product is not in the cart', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      await expect(service.setQuantity(1, 101, { quantity: 2 })).rejects.toThrow(BadRequestException);
    });

    it('removes the row when set to zero or below', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, productId: 101, quantity: 5 });
      const result = await service.setQuantity(1, 101, { quantity: 0 });
      expect(repo.remove).toHaveBeenCalled();
      expect(result).toEqual({ quantity: 0, wasCapped: false });
    });

    it('caps an absolute quantity at available stock', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, productId: 101, quantity: 1 });
      (inventoryClient.getInventoryByIds as jest.Mock).mockResolvedValue([{ productId: 101, stock: 4, isAvailable: true }]);

      const result = await service.setQuantity(1, 101, { quantity: 20 });

      expect(result).toEqual({ quantity: 4, wasCapped: true });
    });
  });
});
