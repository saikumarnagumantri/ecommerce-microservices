import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: {
            getFullInventory: jest.fn(),
            getInventoryByProductId: jest.fn(),
            getInventoryByProductIds: jest.fn(),
            addNewProductToInventory: jest.fn(),
            updateInventoryByProduct: jest.fn(),
            updateInventoryStockByOrder: jest.fn(),
            updateInventoryStockByCancel: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
