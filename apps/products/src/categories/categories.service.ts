import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categoryRepository.find();
  }

  create(dto: CreateCategoryDto): Promise<Category> {
    return this.categoryRepository.save({ name: dto.name, parentId: dto.parentId ?? null });
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOrThrow(id);
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.parentId !== undefined) category.parentId = dto.parentId;
    return this.categoryRepository.save(category);
  }

  async remove(id: number): Promise<void> {
    await this.findOrThrow(id);
    await this.categoryRepository.delete(id);
  }

  private async findOrThrow(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOneBy({ id });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }
}
