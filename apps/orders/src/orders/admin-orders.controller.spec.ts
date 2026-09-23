import { Test, TestingModule } from '@nestjs/testing';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;
  let service: {
    adminList: jest.Mock;
    adminGetDetail: jest.Mock;
    confirm: jest.Mock;
    dispatch: jest.Mock;
    deliver: jest.Mock;
    adminCancel: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      adminList: jest.fn(),
      adminGetDetail: jest.fn(),
      confirm: jest.fn(),
      dispatch: jest.fn(),
      deliver: jest.fn(),
      adminCancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [{ provide: OrdersService, useValue: service }],
    }).compile();

    controller = module.get<AdminOrdersController>(AdminOrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('cancel forwards the order id, the admin id, and the reason/comment dto to adminCancel', async () => {
    const dto = { reason: 'OUT_OF_STOCK' as const, comment: 'No stock left' };

    await controller.cancel(1, dto, { id: 99 } as any);

    expect(service.adminCancel).toHaveBeenCalledWith(1, 99, dto);
  });
});
