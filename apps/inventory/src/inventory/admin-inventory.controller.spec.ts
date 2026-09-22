import { Test, TestingModule } from '@nestjs/testing';
import { AdminInventoryController } from './admin-inventory.controller';
import { InventoryService } from './inventory.service';

describe('AdminInventoryController', () => {
  let controller: AdminInventoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminInventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: {
            getFullInventory: jest.fn(),
            getLowStock: jest.fn(),
            updateInventoryByProduct: jest.fn(),
            restock: jest.fn(),
            adjustStock: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminInventoryController>(AdminInventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
