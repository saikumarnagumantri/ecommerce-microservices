import { ApiProperty } from "@nestjs/swagger";

export class InventoryDTO {
    @ApiProperty({example: 101})
    productId!: number;

    @ApiProperty({example:100})
    inStock!: number ;

    @ApiProperty({example:true})
    isOutOfStock!: boolean;
}

export class InventoryUpdateDTO{
    @ApiProperty({example: 101})
    productId!: number;

    @ApiProperty({example:100})
    inStock!: number ;

    @ApiProperty({example:true})
    isOutOfStock!: boolean;
}