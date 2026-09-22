import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Role } from '@salescart/common';
import { AUTH_NOT_CONFIGURED, BCRYPT_SALT_ROUNDS, DEFAULT_JWT_EXPIRES_IN } from '../constants/users.constants';

@Injectable()
export class AuthService {
  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
  }

  comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  signToken(user: { id: number; role: Role; email: string }): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(AUTH_NOT_CONFIGURED);
    }
    return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? DEFAULT_JWT_EXPIRES_IN) as jwt.SignOptions['expiresIn'],
    });
  }
}
