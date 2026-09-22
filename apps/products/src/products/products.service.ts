import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductFeature } from './entities/product-feature.entity';
import { ProductMedia } from './entities/product-media.entity';
import { ProductQueryDto } from './dto/product-query.dto';
import { BulkCreateProductsDto, CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { ReplaceFeaturesDto } from './dto/feature.dto';
import { AddMediaDto, UpdateMediaDto } from './dto/media.dto';
import {
  BulkCreateProductsResultDto,
  PagedProductsDto,
  ProductDetailDto,
  ProductMediaResponseDto,
  ProductSummaryDto,
} from './dto/product.dto';
import { createInventoryRow, getInventoryByIds, getInventoryByProductId } from './external/inventory.client';

const DISCOUNT_EXCEEDS_ORIGINAL = 'Discount price cannot exceed the original price';
const PRODUCT_NOT_FOUND = (id: number) => `Product with id ${id} not found`;
const MEDIA_NOT_FOUND = 'Media item not found for this product';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductFeature)
    private readonly featureRepository: Repository<ProductFeature>,
    @InjectRepository(ProductMedia)
    private readonly mediaRepository: Repository<ProductMedia>,
  ) {}

  // ---------------------------------------------------------------------
  // Customer-facing catalog
  // ---------------------------------------------------------------------

  async findAll(query: ProductQueryDto): Promise<PagedProductsDto> {
    return this.pagedList(query, true);
  }

  async findDetailById(id: number): Promise<ProductDetailDto> {
    const product = await this.productRepository.findOneBy({ id, isActive: true });
    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND(id));
    }
    return this.buildDetail(product);
  }

  /** Kept for the cart service's existing bulk lookup contract — not filtered by isActive (see E2 notes). */
  async getProductsByIds(productIds: string): Promise<Product[]> {
    if (!productIds) return [];

    const productArray = productIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');
    const idSet = [...new Set(productArray.map((id) => +id))];
    const products = await this.productRepository.findBy({ id: In(idSet) });

    if (products.length === 0) {
      this.logger.warn(`Search failed: Product with ID ${productIds} not found.`);
      throw new NotFoundException(`Product with id ${productIds} not found`);
    }
    if (productArray.length !== products.length) {
      this.logger.warn(
        `Missing products: requested ${productArray.length}, found ${products.length}`,
      );
    }
    return products;
  }

  // ---------------------------------------------------------------------
  // Admin catalog management
  // ---------------------------------------------------------------------

  adminFindAll(query: ProductQueryDto): Promise<PagedProductsDto> {
    return this.pagedList(query, false);
  }

  async adminFindDetailById(id: number): Promise<ProductDetailDto> {
    const product = await this.findRawById(id);
    return this.buildDetail(product);
  }

  async create(dto: CreateProductDto): Promise<ProductDetailDto> {
    this.assertPriceValid(dto.originalPrice, dto.discountPrice);

    const saved = await this.productRepository.save({
      name: dto.name,
      description: dto.description,
      categoryId: dto.categoryId,
      brand: dto.brand,
      originalPrice: dto.originalPrice,
      discountPrice: dto.discountPrice,
      isActive: true,
      forceOutOfStock: false,
    });

    await createInventoryRow(saved.id, dto.initialStock ?? 0);
    this.logger.log(`Created product ${saved.id} (${saved.name})`);
    return this.buildDetail(saved);
  }

  /**
   * Creates each product independently so one bad row (a duplicate name,
   * an invalid category) doesn't block the rest of the batch — the same
   * partial-success shape as the bulk order confirm endpoint.
   */
  async createBulk(dto: BulkCreateProductsDto): Promise<BulkCreateProductsResultDto> {
    const created: ProductDetailDto[] = [];
    const failed: { index: number; error: string }[] = [];

    for (let index = 0; index < dto.products.length; index += 1) {
      try {
        created.push(await this.create(dto.products[index]));
      } catch (err) {
        failed.push({ index, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return { created, failed };
  }

  async update(id: number, dto: UpdateProductDto): Promise<ProductDetailDto> {
    const product = await this.findRawById(id);

    this.assertPriceValid(
      dto.originalPrice ?? product.originalPrice,
      dto.discountPrice ?? product.discountPrice,
    );

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.categoryId !== undefined) product.categoryId = dto.categoryId;
    if (dto.brand !== undefined) product.brand = dto.brand;
    if (dto.originalPrice !== undefined) product.originalPrice = dto.originalPrice;
    if (dto.discountPrice !== undefined) product.discountPrice = dto.discountPrice;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    if (dto.forceOutOfStock !== undefined) product.forceOutOfStock = dto.forceOutOfStock;

    await this.productRepository.save(product);
    return this.buildDetail(product);
  }

  /** Soft-delete: hides the product from customers without losing its history (orders reference it by snapshot anyway). */
  async softDelete(id: number): Promise<void> {
    const product = await this.findRawById(id);
    product.isActive = false;
    await this.productRepository.save(product);
  }

  async replaceFeatures(productId: number, dto: ReplaceFeaturesDto): Promise<ProductDetailDto> {
    const product = await this.findRawById(productId);

    await this.featureRepository.delete({ productId });
    if (dto.features.length > 0) {
      await this.featureRepository.save(
        dto.features.map((f, index) => ({
          productId,
          label: f.label,
          value: f.value,
          sortOrder: index,
        })),
      );
    }
    return this.buildDetail(product);
  }

  async addMedia(productId: number, dto: AddMediaDto): Promise<ProductMediaResponseDto> {
    await this.findRawById(productId);

    const count = await this.mediaRepository.countBy({ productId });
    // A product's first media item is always primary, same invariant as
    // a user's first address always being their default.
    const isPrimary = count === 0 ? true : Boolean(dto.isPrimary);
    if (isPrimary) {
      await this.clearOtherPrimaryMedia(productId);
    }

    const saved = await this.mediaRepository.save({
      productId,
      type: dto.type,
      url: dto.url,
      sortOrder: count,
      isPrimary,
    });
    return saved;
  }

  async updateMedia(
    productId: number,
    mediaId: number,
    dto: UpdateMediaDto,
  ): Promise<ProductMediaResponseDto> {
    const media = await this.findOwnedMedia(productId, mediaId);

    if (dto.sortOrder !== undefined) media.sortOrder = dto.sortOrder;
    if (dto.isPrimary === true) {
      await this.clearOtherPrimaryMedia(productId, mediaId);
      media.isPrimary = true;
    }
    await this.mediaRepository.save(media);
    return media;
  }

  async removeMedia(productId: number, mediaId: number): Promise<void> {
    const media = await this.findOwnedMedia(productId, mediaId);
    await this.mediaRepository.remove(media);

    if (media.isPrimary) {
      const remaining = await this.mediaRepository.find({
        where: { productId },
        order: { sortOrder: 'ASC' },
      });
      if (remaining.length > 0) {
        remaining[0].isPrimary = true;
        await this.mediaRepository.save(remaining[0]);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private assertPriceValid(originalPrice: number, discountPrice: number): void {
    if (discountPrice > originalPrice) {
      throw new BadRequestException(DISCOUNT_EXCEEDS_ORIGINAL);
    }
  }

  private async findRawById(id: number): Promise<Product> {
    const product = await this.productRepository.findOneBy({ id });
    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND(id));
    }
    return product;
  }

  private async findOwnedMedia(productId: number, mediaId: number): Promise<ProductMedia> {
    const media = await this.mediaRepository.findOneBy({ id: mediaId, productId });
    if (!media) {
      throw new NotFoundException(MEDIA_NOT_FOUND);
    }
    return media;
  }

  private async clearOtherPrimaryMedia(productId: number, exceptId?: number): Promise<void> {
    const others = (await this.mediaRepository.findBy({ productId })).filter(
      (m) => m.isPrimary && m.id !== exceptId,
    );
    if (others.length > 0) {
      await this.mediaRepository.save(others.map((m) => ({ ...m, isPrimary: false })));
    }
  }

  private async pagedList(query: ProductQueryDto, activeOnly: boolean): Promise<PagedProductsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.productRepository.createQueryBuilder('p');
    if (activeOnly) {
      qb.andWhere('p.isActive = true');
    }
    if (query.search) {
      qb.andWhere('(p.name ILIKE :search OR p.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('p.categoryId = :categoryId', { categoryId: query.categoryId });
    }
    qb.orderBy('p.id', 'ASC').skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    const data = await this.toSummaries(rows);

    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  private async toSummaries(products: Product[]): Promise<ProductSummaryDto[]> {
    if (products.length === 0) return [];

    const ids = products.map((p) => p.id);
    const [primaryMedia, stock] = await Promise.all([
      this.mediaRepository.findBy({ productId: In(ids), isPrimary: true }),
      getInventoryByIds(ids),
    ]);

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      categoryId: p.categoryId,
      originalPrice: p.originalPrice,
      discountPrice: p.discountPrice,
      isActive: p.isActive,
      forceOutOfStock: p.forceOutOfStock,
      primaryImageUrl: primaryMedia.find((m) => m.productId === p.id)?.url ?? null,
      // A missing inventory row (never stocked) reads as unavailable, same
      // as the detail endpoint; an admin's forceOutOfStock override always
      // wins over the real stock count.
      isAvailable: p.forceOutOfStock ? false : stock.find((s) => s.productId === p.id)?.isAvailable ?? false,
      createdAt: p.createdAt,
    }));
  }

  private async buildDetail(product: Product): Promise<ProductDetailDto> {
    const [features, media, stock] = await Promise.all([
      this.featureRepository.find({ where: { productId: product.id }, order: { sortOrder: 'ASC' } }),
      this.mediaRepository.find({ where: { productId: product.id }, order: { sortOrder: 'ASC' } }),
      getInventoryByProductId(product.id),
    ]);
    const primary = media.find((m) => m.isPrimary) ?? media[0];

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      originalPrice: product.originalPrice,
      discountPrice: product.discountPrice,
      isActive: product.isActive,
      forceOutOfStock: product.forceOutOfStock,
      primaryImageUrl: primary?.url ?? null,
      createdAt: product.createdAt,
      description: product.description,
      features: features.map((f) => ({ label: f.label, value: f.value, sortOrder: f.sortOrder })),
      media: media.map((m) => ({
        id: m.id,
        type: m.type,
        url: m.url,
        sortOrder: m.sortOrder,
        isPrimary: m.isPrimary,
      })),
      // Inventory being unreachable degrades to "0 / unavailable" rather
      // than failing the whole detail call (E2-5's AC). An admin's
      // forceOutOfStock override always wins over the real stock count.
      stock: stock?.stock ?? 0,
      isAvailable: product.forceOutOfStock ? false : stock?.isAvailable ?? false,
    };
  }
}
