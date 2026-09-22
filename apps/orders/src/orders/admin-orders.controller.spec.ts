import { Test, TestingModule } from '@nestjs/testing';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            adminList: jest.fn(),
            adminGetDetail: jest.fn(),
            confirm: jest.fn(),
            dispatch: jest.fn(),
            deliver: jest.fn(),
            adminCancel: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminOrdersController>(AdminOrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
