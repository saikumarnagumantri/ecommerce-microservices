import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '@salescart/common';
import { AdminSeederService } from './admin-seeder.service';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

describe('AdminSeederService', () => {
  const OLD_ENV = { ...process.env };
  let repo: { findOneBy: jest.Mock; save: jest.Mock };
  let authService: { hashPassword: jest.Mock };
  let service: AdminSeederService;

  beforeEach(async () => {
    repo = { findOneBy: jest.fn(), save: jest.fn() };
    authService = { hashPassword: jest.fn().mockResolvedValue('hashed') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSeederService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<AdminSeederService>(AdminSeederService);
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('does nothing when ADMIN_EMAIL/ADMIN_PASSWORD are not set', async () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    await service.onApplicationBootstrap();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('does nothing when that admin email already exists (idempotent across restarts)', async () => {
    process.env.ADMIN_EMAIL = 'admin@x.com';
    process.env.ADMIN_PASSWORD = 'secret123';
    repo.findOneBy.mockResolvedValue({ id: 1, email: 'admin@x.com' });

    await service.onApplicationBootstrap();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('creates the admin with role ADMIN when none exists yet', async () => {
    process.env.ADMIN_EMAIL = 'admin@x.com';
    process.env.ADMIN_PASSWORD = 'secret123';
    process.env.ADMIN_NAME = 'Boss';
    repo.findOneBy.mockResolvedValue(null);

    await service.onApplicationBootstrap();

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@x.com', role: Role.ADMIN, passwordHash: 'hashed' }),
    );
  });
});
