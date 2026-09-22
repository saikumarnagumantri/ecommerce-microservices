import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

type MockRepo = Partial<Record<keyof Repository<Product>, jest.Mock>>;

const SAMPLE: Product = {
  id: 101,
  name: 'UltraBook Pro 15',
  description: 'A laptop',
  category: 1,
  spec: { name: 'UltraBook', brand: 'TechNova', yearOfManufacture: '2024-01-15', material: 'Aluminum' },
  originalPrice: 1500,
  discountPrice: 1350,
  offers: [],
  images: [],
  isOutOfStock: false,
};

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: getRepositoryToken(Product), useValue: repo }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getProducts returns everything in the repository', async () => {
    repo.find!.mockResolvedValue([SAMPLE]);
    await expect(service.getProducts()).resolves.toEqual([SAMPLE]);
  });

  it('getProductById returns the match', async () => {
    repo.findOneBy!.mockResolvedValue(SAMPLE);
    await expect(service.getProductById(101)).resolves.toEqual(SAMPLE);
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: 101 });
  });

  it('getProductById throws NotFoundException when nothing matches', async () => {
    repo.findOneBy!.mockResolvedValue(null);
    await expect(service.getProductById(999)).rejects.toThrow(NotFoundException);
  });

  it('getProductsByIds returns [] for an empty input without querying', async () => {
    await expect(service.getProductsByIds('')).resolves.toEqual([]);
    expect(repo.findBy).not.toHaveBeenCalled();
  });

  it('getProductsByIds throws NotFoundException when none of the ids match', async () => {
    repo.findBy!.mockResolvedValue([]);
    await expect(service.getProductsByIds('101,202')).rejects.toThrow(NotFoundException);
  });

  it('getProductsByIds returns whatever subset was found', async () => {
    repo.findBy!.mockResolvedValue([SAMPLE]);
    await expect(service.getProductsByIds('101,202')).resolves.toEqual([SAMPLE]);
  });
});
