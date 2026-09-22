import { Test, TestingModule } from '@nestjs/testing';
import { AdminProductsController } from './admin-products.controller';
import { ProductsService } from './products.service';

describe('AdminProductsController', () => {
  let controller: AdminProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: {
            adminFindAll: jest.fn(),
            adminFindDetailById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            replaceFeatures: jest.fn(),
            addMedia: jest.fn(),
            updateMedia: jest.fn(),
            removeMedia: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminProductsController>(AdminProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
