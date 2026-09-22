import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants';

/** Marks a route as not requiring a JWT, for use under JwtAuthGuard (e.g. login, register, product browsing). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
