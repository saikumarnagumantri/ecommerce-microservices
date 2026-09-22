import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';

jest.mock('./exteranl/products.client', () => ({ getProductsByIds: jest.fn().mockResolvedValue([]) }));
jest.mock('./exteranl/inventory.client', () => ({ getInventoryByIds: jest.fn().mockResolvedValue([]) }));

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [CartService, { provide: getRepositoryToken(CartItem), useValue: repo }],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getCart returns an empty item list without calling other services when the cart is empty', async () => {
    repo.findBy!.mockResolvedValue([]);
    await expect(service.getCart(123)).resolves.toEqual({ userId: 123, items: [] });
  });

  describe('addProductToCart', () => {
    it('rejects a non-positive quantity', async () => {
      await expect(
        service.addProductToCart({ userId: 1, productId: 101, quantity: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('merges into an existing row instead of creating a duplicate', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, productId: 101, quantity: 2 });
      await service.addProductToCart({ userId: 1, productId: 101, quantity: 3 });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, quantity: 5 }),
      );
    });

    it('creates a new row when none exists yet', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      await service.addProductToCart({ userId: 1, productId: 101, quantity: 2 });
      expect(repo.save).toHaveBeenCalledWith({ userId: 1, productId: 101, quantity: 2 });
    });
  });

  describe('updateQuantityByProduct', () => {
    it('throws when the product is not in the cart', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      await expect(
        service.updateQuantityByProduct(1, { userId: 1, productId: 101, quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('removes the row once quantity drops to zero or below', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, productId: 101, quantity: 2 });
      await service.updateQuantityByProduct(1, { userId: 1, productId: 101, quantity: -2 });
      expect(repo.remove).toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('saves the updated quantity otherwise', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, productId: 101, quantity: 2 });
      await service.updateQuantityByProduct(1, { userId: 1, productId: 101, quantity: 1 });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 3 }),
      );
    });
  });
});
