import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@salescart/common';
import { UsersService } from './users.service';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

type MockRepo = Partial<Record<keyof Repository<User>, jest.Mock>>;

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepo;
  let authService: { hashPassword: jest.Mock; comparePassword: jest.Mock; signToken: jest.Mock };

  beforeEach(async () => {
    repo = { findOneBy: jest.fn(), save: jest.fn() };
    authService = {
      hashPassword: jest.fn().mockResolvedValue('hashed'),
      comparePassword: jest.fn(),
      signToken: jest.fn().mockReturnValue('a.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('register', () => {
    it('rejects a duplicate email with 409', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, email: 'a@b.com' });
      await expect(
        service.register({ email: 'a@b.com', password: 'password1', name: 'A' }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password and forces role to CUSTOMER, never returning the hash', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      repo.save!.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        passwordHash: 'hashed',
        name: 'A',
        phone: null,
        role: Role.CUSTOMER,
        createdAt: new Date(),
      });

      const result = await service.register({ email: 'a@b.com', password: 'password1', name: 'A' });

      expect(authService.hashPassword).toHaveBeenCalledWith('password1');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.CUSTOMER, passwordHash: 'hashed' }),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('rejects an unknown email with a generic 401', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      await expect(service.login({ email: 'nope@b.com', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password with the same generic 401', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, email: 'a@b.com', passwordHash: 'hashed' });
      authService.comparePassword.mockResolvedValue(false);
      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns a signed token and the sanitized profile on success', async () => {
      const user = {
        id: 1,
        email: 'a@b.com',
        passwordHash: 'hashed',
        name: 'A',
        phone: null,
        role: Role.ADMIN,
        createdAt: new Date(),
      };
      repo.findOneBy!.mockResolvedValue(user);
      authService.comparePassword.mockResolvedValue(true);

      const result = await service.login({ email: 'a@b.com', password: 'right' });

      expect(authService.signToken).toHaveBeenCalledWith(user);
      expect(result).toEqual({ accessToken: 'a.jwt.token', user: expect.objectContaining({ role: Role.ADMIN }) });
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateProfile', () => {
    it('throws NotFoundException for an unknown user', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      await expect(service.updateProfile(999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates only name/phone, never role', async () => {
      const user = {
        id: 1,
        email: 'a@b.com',
        passwordHash: 'hashed',
        name: 'Old',
        phone: null,
        role: Role.CUSTOMER,
        createdAt: new Date(),
      };
      repo.findOneBy!.mockResolvedValue(user);

      const result = await service.updateProfile(1, { name: 'New Name' });

      expect(user.name).toBe('New Name');
      expect(result.role).toBe(Role.CUSTOMER);
    });
  });
});
