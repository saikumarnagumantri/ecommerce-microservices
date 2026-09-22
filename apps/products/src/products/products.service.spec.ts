import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductFeature } from './entities/product-feature.entity';
import { ProductMedia, MediaType } from './entities/product-media.entity';
import * as inventoryClient from './external/inventory.client';

jest.mock('./external/inventory.client');

type MockRepo<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function fakeQueryBuilder(rows: Product[], total: number) {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
  return qb;
}

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepo: MockRepo<Product>;
  let featureRepo: MockRepo<ProductFeature>;
  let mediaRepo: MockRepo<ProductMedia>;

  beforeEach(async () => {
    productRepo = {
      findOneBy: jest.fn(),
      findBy: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    featureRepo = { find: jest.fn().mockResolvedValue([]), delete: jest.fn(), save: jest.fn() };
    mediaRepo = {
      find: jest.fn().mockResolvedValue([]),
      findBy: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      countBy: jest.fn().mockResolvedValue(0),
      save: jest.fn(),
      remove: jest.fn(),
    };

    (inventoryClient.getInventoryByProductId as jest.Mock).mockResolvedValue({
      productId: 101,
      stock: 5,
      isAvailable: true,
    });
    (inventoryClient.createInventoryRow as jest.Mock).mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(ProductFeature), useValue: featureRepo },
        { provide: getRepositoryToken(ProductMedia), useValue: mediaRepo },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findDetailById', () => {
    it('throws NotFoundException for an inactive or missing product (customer view)', async () => {
      productRepo.findOneBy!.mockResolvedValue(null);
      await expect(service.findDetailById(999)).rejects.toThrow(NotFoundException);
      expect(productRepo.findOneBy).toHaveBeenCalledWith({ id: 999, isActive: true });
    });

    it('degrades to 0/unavailable when inventory cannot be reached', async () => {
      productRepo.findOneBy!.mockResolvedValue({ id: 101, isActive: true, name: 'X' } as Product);
      (inventoryClient.getInventoryByProductId as jest.Mock).mockResolvedValue(null);

      const result = await service.findDetailById(101);
      expect(result.stock).toBe(0);
      expect(result.isAvailable).toBe(false);
    });
  });

  describe('create', () => {
    it('rejects a discount price above the original price', async () => {
      await expect(
        service.create({
          name: 'X', description: 'd', categoryId: 1, brand: 'B', originalPrice: 100, discountPrice: 150,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(productRepo.save).not.toHaveBeenCalled();
    });

    it('creates the inventory row for the new product', async () => {
      productRepo.save!.mockResolvedValue({ id: 999, isActive: true } as Product);

      await service.create({
        name: 'X', description: 'd', categoryId: 1, brand: 'B', originalPrice: 100, discountPrice: 80, initialStock: 15,
      });

      expect(inventoryClient.createInventoryRow).toHaveBeenCalledWith(999, 15);
    });
  });

  describe('update', () => {
    it('rejects when the update would make discount exceed original', async () => {
      productRepo.findOneBy!.mockResolvedValue({ id: 1, originalPrice: 100, discountPrice: 80 } as Product);
      await expect(service.update(1, { discountPrice: 150 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('sets isActive to false rather than removing the row', async () => {
      const product = { id: 1, isActive: true } as Product;
      productRepo.findOneBy!.mockResolvedValue(product);

      await service.softDelete(1);

      expect(product.isActive).toBe(false);
      expect(productRepo.save).toHaveBeenCalledWith(product);
    });
  });

  describe('replaceFeatures', () => {
    it('deletes the old list and inserts the new one with sortOrder = array index', async () => {
      productRepo.findOneBy!.mockResolvedValue({ id: 1 } as Product);

      await service.replaceFeatures(1, {
        features: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }],
      });

      expect(featureRepo.delete).toHaveBeenCalledWith({ productId: 1 });
      expect(featureRepo.save).toHaveBeenCalledWith([
        { productId: 1, label: 'A', value: '1', sortOrder: 0 },
        { productId: 1, label: 'B', value: '2', sortOrder: 1 },
      ]);
    });
  });

  describe('addMedia', () => {
    it('forces the first media item to be primary regardless of the flag sent', async () => {
      productRepo.findOneBy!.mockResolvedValue({ id: 1 } as Product);
      mediaRepo.countBy!.mockResolvedValue(0);
      mediaRepo.save!.mockImplementation(async (m) => ({ id: 10, ...m }));

      const result = await service.addMedia(1, { type: MediaType.IMAGE, url: 'x.jpg', isPrimary: false });
      expect(result.isPrimary).toBe(true);
    });

    it('clears the previous primary when a new one is added as primary', async () => {
      productRepo.findOneBy!.mockResolvedValue({ id: 1 } as Product);
      mediaRepo.countBy!.mockResolvedValue(1);
      mediaRepo.findBy!.mockResolvedValue([{ id: 5, productId: 1, isPrimary: true }]);
      mediaRepo.save!.mockImplementation(async (m) => (Array.isArray(m) ? m : { id: 11, ...m }));

      await service.addMedia(1, { type: MediaType.IMAGE, url: 'y.jpg', isPrimary: true });

      expect(mediaRepo.save).toHaveBeenCalledWith([expect.objectContaining({ id: 5, isPrimary: false })]);
    });
  });

  describe('removeMedia', () => {
    it('rejects removing a media item that does not belong to the product', async () => {
      mediaRepo.findOneBy!.mockResolvedValue(null);
      await expect(service.removeMedia(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('promotes another media item to primary when the primary one is removed', async () => {
      mediaRepo.findOneBy!.mockResolvedValue({ id: 1, productId: 1, isPrimary: true });
      mediaRepo.find!.mockResolvedValue([{ id: 2, productId: 1, isPrimary: false }]);

      await service.removeMedia(1, 1);

      expect(mediaRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 2, isPrimary: true }));
    });
  });

  describe('findAll (customer list)', () => {
    it('filters to isActive products only', async () => {
      const qb = fakeQueryBuilder([], 0);
      productRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith('p.isActive = true');
    });
  });

  describe('adminFindAll', () => {
    it('does not filter by isActive', async () => {
      const qb = fakeQueryBuilder([], 0);
      productRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.adminFindAll({ page: 1, limit: 20 });

      expect(qb.andWhere).not.toHaveBeenCalledWith('p.isActive = true');
    });
  });
});
