import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@salescart/common';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';

/**
 * Ensures exactly one admin account exists, created from env vars on
 * boot. Idempotent: does nothing if that email is already registered, so
 * it's safe to run on every restart. Public registration (RegisterDto)
 * has no `role` field, so this is the only way an ADMIN account is ever
 * created.
 */
@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME ?? 'Admin';

    if (!email || !password) {
      this.logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed.');
      return;
    }

    const existing = await this.userRepository.findOneBy({ email });
    if (existing) {
      this.logger.log(`Admin account already exists: ${email}`);
      return;
    }

    const passwordHash = await this.authService.hashPassword(password);
    await this.userRepository.save({
      email,
      passwordHash,
      name,
      phone: null,
      role: Role.ADMIN,
    });
    this.logger.log(`Seeded admin account: ${email}`);
  }
}
