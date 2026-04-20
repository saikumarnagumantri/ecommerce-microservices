import { Injectable, NotFoundException } from '@nestjs/common';
import { INVENTORY_NOT_FOUND } from 'src/constants/inventory.constants';
import { INVENTORY } from 'src/data/inventory.data';
import { InventoryDTO, InventoryUpdateDTO } from 'src/dto/inventory.dto';

@Injectable()
export class InventoryService {


    getFullInventory(){
        return INVENTORY
    }

    getInventoryByProductId (productId:number): InventoryDTO[] | undefined{

        const inventory = INVENTORY.filter((inv) => inv.productId === productId)

        if(!inventory){
            throw new NotFoundException(`${INVENTORY_NOT_FOUND} ${productId}`)
        }
        return inventory;
    }

    updateInventoryByProduct(productId: number, updateInventory:InventoryUpdateDTO){
        return INVENTORY.map((inv) => inv.productId === productId ? updateInventory : inv)
    }
}
