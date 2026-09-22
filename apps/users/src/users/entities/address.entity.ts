import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'addresses', schema: 'users' })
export class Address {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'varchar', length: 255 })
  line1!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  line2!: string | null;

  @Column({ type: 'varchar', length: 128 })
  city!: string;

  @Column({ type: 'varchar', length: 128 })
  state!: string;

  @Column({ type: 'varchar', length: 32 })
  postalCode!: string;

  @Column({ type: 'varchar', length: 128 })
  country!: string;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;
}
