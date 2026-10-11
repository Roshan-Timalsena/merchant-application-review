import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('test-token'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('hashPassword / verifyPassword', () => {
    it('hashes and verifies a password', async () => {
      const hash = await service.hashPassword('password123');
      expect(hash).not.toEqual('password123');
      await expect(
        service.verifyPassword('password123', hash),
      ).resolves.toBe(true);
      await expect(
        service.verifyPassword('wrong-password', hash),
      ).resolves.toBe(false);
    });
  });

  describe('register', () => {
    it('creates a user and returns a JWT', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hash',
        role: UserRole.SALES,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('test-token');
      expect(result.user.email).toBe('user@example.com');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('rejects duplicate emails', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hash',
        role: UserRole.SALES,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.register({
          email: 'user@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('login', () => {
    it('returns a JWT for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
        role: UserRole.SALES,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.login({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('test-token');
    });

    it('rejects invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'missing@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
