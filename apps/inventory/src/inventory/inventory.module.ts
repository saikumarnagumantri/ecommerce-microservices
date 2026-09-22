import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { AdminInventoryController } from './admin-inventory.controller';
import { InventoryService } from './inventory.service';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inventory, InventoryMovement])],
  controllers: [InventoryController, AdminInventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
