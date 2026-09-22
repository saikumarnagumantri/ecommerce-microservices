import { ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@salescart/common';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthResponseDto, UserProfileDto } from './dto/user-profile.dto';
import { AuthService } from './auth.service';
import { EMAIL_ALREADY_REGISTERED, INVALID_CREDENTIALS, USER_NOT_FOUND } from '../constants/users.constants';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  private toProfile(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async register(dto: RegisterDto): Promise<UserProfileDto> {
    const existing = await this.userRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED);
    }

    const passwordHash = await this.authService.hashPassword(dto.password);
    const user = await this.userRepository.save({
      email: dto.email,
      passwordHash,
      name: dto.name,
      phone: dto.phone ?? null,
      role: Role.CUSTOMER, // public registration can never create an admin
    });

    this.logger.log(`Registered user ${user.email}`);
    return this.toProfile(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOneBy({ email: dto.email });
    // Same generic message whether the email is unknown or the password
    // is wrong, so a caller can't use this endpoint to enumerate accounts.
    if (!user || !(await this.authService.comparePassword(dto.password, user.passwordHash))) {
      this.logger.warn(`Failed login attempt for ${dto.email}`);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const accessToken = this.authService.signToken(user);
    return { accessToken, user: this.toProfile(user) };
  }

  async findById(id: number): Promise<UserProfileDto> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND);
    }
    return this.toProfile(user);
  }

  async updateProfile(id: number, dto: UpdateProfileDto): Promise<UserProfileDto> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND);
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    await this.userRepository.save(user);

    return this.toProfile(user);
  }
}
