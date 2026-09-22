# Sprint 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete EPIC 0 (E0-3, E0-4, E0-5 — E0-1 and E0-2 are already done) so every later epic has shared cross-cutting code and real persistence to build on.

**Architecture:** A new `libs/common` package (plain npm package, not a Nest monorepo — the 7 apps stay independent) holds a global validation pipe, a global exception filter, a pagination helper, and three guards (JWT, roles, internal-key) with unit tests; every app depends on it via a `file:` reference and installs its own copy so Node module resolution never has to cross a symlink boundary. `products`, `inventory`, and `cart` swap their in-memory arrays for TypeORM repositories against Postgres, each in its own schema (`catalog`, `inventory`, `cart`) inside the single `salescart` database already provisioned in `infra/docker-compose.yml`. Root `package.json` gains `test:all` and `build:all` alongside the existing `start:all`.

**Tech Stack:** NestJS 11, TypeORM 0.3 + `pg`, `@nestjs/jwt`, `class-validator`/`class-transformer`, Jest/ts-jest, `dotenv` (already added in E0-2).

**Spec:** `docs/sprint-1.md` (EPIC 0, section 2) and `docs/salescart-blueprint.html` (architecture section — schema-per-service, shared `libs/common`).

## Global Constraints

- Windows dev machine: use `cmd /c "cd <dir> && <cmd>"` wrapping in root `package.json` scripts, exactly like the existing `start:*` scripts.
- Every service already loads `dotenv/config` as the first import of `main.ts` (from E0-2) — any new entry point that reads `process.env` directly (migration data sources, seed scripts) must also import `dotenv/config` first, since it runs outside `main.ts`.
- No secrets committed. `.env.example` gets placeholders only; real values go in each service's local, gitignored `.env`.
- `libs/common` is consumed via `"@salescart/common": "file:../../libs/common"` and must be built (`npm run build` inside `libs/common`) before any consuming app installs or starts — its own `dependencies` (not `peerDependencies`) include `@nestjs/common`, `@nestjs/core`, `@nestjs/jwt`, `@nestjs/swagger`, `class-validator`, `class-transformer`, `rxjs`, `reflect-metadata`, so its own `node_modules` resolves everything it needs without relying on the consuming app's `node_modules` (Windows `file:` deps are directory junctions, and Node resolves a required file's own directory tree, not the consumer's).
- Postgres schema-per-service: each service's `DataSource`/`TypeOrmModule.forRoot` sets `schema: process.env.DB_SCHEMA`, and each service's first migration runs `CREATE SCHEMA IF NOT EXISTS "<schema>"` before creating its own tables.
- Preserve existing route paths and response shapes exactly (E0-1 already fixed the bugs that were in scope there) — this plan only swaps the storage backend, except where a step explicitly calls out a pre-existing correctness bug being fixed as an unavoidable side effect of touching that code.

---

### Task 1: `libs/common` — validation pipe, exception filter, pagination helper

**Files:**
- Create: `libs/common/package.json`
- Create: `libs/common/tsconfig.json`
- Create: `libs/common/src/pipes/validation.pipe.ts`
- Create: `libs/common/src/pipes/validation.pipe.spec.ts`
- Create: `libs/common/src/filters/all-exceptions.filter.ts`
- Create: `libs/common/src/filters/all-exceptions.filter.spec.ts`
- Create: `libs/common/src/pagination/pagination-query.dto.ts`
- Create: `libs/common/src/pagination/paginate.ts`
- Create: `libs/common/src/pagination/paginate.spec.ts`
- Create: `libs/common/src/index.ts` (partial — Task 2 appends to it)

**Interfaces:**
- Produces: `AppValidationPipe` (class, `ValidationPipeOptions` optional ctor arg), `AllExceptionsFilter` (class, no ctor args), `PaginationQueryDto` (class with `page: number`, `limit: number`), `buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta`, `paginateArray<T>(items: T[], page: number, limit: number): PaginatedResult<T>`. All re-exported from `libs/common/src/index.ts`.

- [ ] **Step 1: Create the package scaffold**

`libs/common/package.json`:

```json
{
  "name": "@salescart/common",
  "version": "1.0.0",
  "description": "Shared cross-cutting code for SalesCart services: validation, error handling, auth guards, pagination.",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "jest"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/swagger": "^11.3.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/testing": "^11.0.1",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.0.0",
    "jest": "^30.0.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "testEnvironment": "node"
  }
}
```

`libs/common/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "declaration": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "skipLibCheck": true,
    "strict": false,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

Run (from repo root): `cd libs/common && npm install`

- [ ] **Step 2: Write the failing tests for the validation pipe**

`libs/common/src/pipes/validation.pipe.spec.ts`:

```ts
import { IsInt, IsString, Min } from 'class-validator';
import { BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { AppValidationPipe } from './validation.pipe';

class SampleDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

const metadata: ArgumentMetadata = {
  type: 'body',
  metatype: SampleDto,
  data: '',
};

describe('AppValidationPipe', () => {
  const pipe = new AppValidationPipe();

  it('transforms a valid plain object into the DTO instance', async () => {
    const result = await pipe.transform({ name: 'Widget', quantity: 3 }, metadata);
    expect(result).toBeInstanceOf(SampleDto);
    expect(result.quantity).toBe(3);
  });

  it('rejects a payload missing a required field', async () => {
    await expect(pipe.transform({ name: 'Widget' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a payload that has fields not declared on the DTO', async () => {
    await expect(
      pipe.transform({ name: 'Widget', quantity: 3, hacked: true }, metadata),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd libs/common && npm test -- validation.pipe`
Expected: FAIL — `Cannot find module './validation.pipe'`

- [ ] **Step 4: Implement the validation pipe**

`libs/common/src/pipes/validation.pipe.ts`:

```ts
import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

const DEFAULT_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
};

export class AppValidationPipe extends ValidationPipe {
  constructor(options: ValidationPipeOptions = {}) {
    super({ ...DEFAULT_OPTIONS, ...options });
  }
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `cd libs/common && npm test -- validation.pipe`
Expected: PASS (3 tests)

- [ ] **Step 6: Write the failing tests for the exception filter**

`libs/common/src/filters/all-exceptions.filter.spec.ts`:

```ts
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(url = '/widgets') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('formats a NestJS HttpException using its own status and message', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = makeHost();

    filter.catch(new BadRequestException('quantity must be positive'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'quantity must be positive',
        path: '/widgets',
      }),
    );
  });

  it('maps an unrecognised error to 500 without leaking its message', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = makeHost('/crash');

    filter.catch(new Error('db connection string leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        path: '/crash',
      }),
    );
  });
});
```

- [ ] **Step 7: Run it to see it fail**

Run: `cd libs/common && npm test -- all-exceptions.filter`
Expected: FAIL — `Cannot find module './all-exceptions.filter'`

- [ ] **Step 8: Implement the exception filter**

`libs/common/src/filters/all-exceptions.filter.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException ? exception.getResponse() : null;
    const message =
      body && typeof body === 'object' && 'message' in body
        ? (body as { message: unknown }).message
        : isHttpException
          ? exception.message
          : 'Internal server error';
    const error =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: unknown }).error
        : HttpStatus[status];

    if (!isHttpException) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 9: Run it to see it pass**

Run: `cd libs/common && npm test -- all-exceptions.filter`
Expected: PASS (2 tests)

- [ ] **Step 10: Write the failing tests for pagination**

`libs/common/src/pagination/paginate.spec.ts`:

```ts
import { buildPaginationMeta, paginateArray } from './paginate';

describe('buildPaginationMeta', () => {
  it('computes total pages, rounding up', () => {
    expect(buildPaginationMeta(45, 1, 20)).toEqual({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it('returns 0 total pages for an empty collection', () => {
    expect(buildPaginationMeta(0, 1, 20)).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });
});

describe('paginateArray', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('returns the requested page slice', () => {
    const result = paginateArray(items, 2, 10);
    expect(result.data).toEqual(items.slice(10, 20));
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  it('returns an empty slice past the last page', () => {
    const result = paginateArray(items, 5, 10);
    expect(result.data).toEqual([]);
  });
});
```

- [ ] **Step 11: Run it to see it fail**

Run: `cd libs/common && npm test -- paginate`
Expected: FAIL — `Cannot find module './paginate'`

- [ ] **Step 12: Implement pagination**

`libs/common/src/pagination/pagination-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
```

`libs/common/src/pagination/paginate.ts`:

```ts
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number,
): PaginatedResult<T> {
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);
  return { data, meta: buildPaginationMeta(items.length, page, limit) };
}
```

- [ ] **Step 13: Run it to see it pass**

Run: `cd libs/common && npm test -- paginate`
Expected: PASS (4 tests)

- [ ] **Step 14: Create the barrel file**

`libs/common/src/index.ts`:

```ts
export * from './pipes/validation.pipe';
export * from './filters/all-exceptions.filter';
export * from './pagination/pagination-query.dto';
export * from './pagination/paginate';
```

- [ ] **Step 15: Build and run the full suite**

Run: `cd libs/common && npm run build && npm test`
Expected: `dist/` is created with `index.js`/`index.d.ts`; all 9 tests pass.

- [ ] **Step 16: Commit**

```bash
git add libs/common
git commit -m "feat(common): add validation pipe, exception filter, pagination helper"
```

---

### Task 2: `libs/common` — JWT guard, roles guard, internal-key guard

**Files:**
- Create: `libs/common/src/decorators/roles.decorator.ts`
- Create: `libs/common/src/decorators/current-user.decorator.ts`
- Create: `libs/common/src/guards/jwt-auth.guard.ts`
- Create: `libs/common/src/guards/jwt-auth.guard.spec.ts`
- Create: `libs/common/src/guards/roles.guard.ts`
- Create: `libs/common/src/guards/roles.guard.spec.ts`
- Create: `libs/common/src/guards/internal-key.guard.ts`
- Create: `libs/common/src/guards/internal-key.guard.spec.ts`
- Modify: `libs/common/src/index.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `Role = 'CUSTOMER' | 'ADMIN'`, `Roles(...roles: Role[])` decorator, `AuthenticatedUser { sub: number; role: Role }`, `CurrentUser()` param decorator, `JwtAuthGuard` (ctor: `JwtService`), `RolesGuard` (ctor: `Reflector`), `InternalKeyGuard` (no ctor args, reads `process.env.INTERNAL_API_KEY`). These are the guards E1 (login issues the JWT) and E6 (gateway applies `JwtAuthGuard`/`RolesGuard`, downstream services apply `InternalKeyGuard`) will wire up later — this task only builds and unit-tests them; no controller in the repo applies them yet.

- [ ] **Step 1: Write the failing tests for the JWT guard**

`libs/common/src/guards/jwt-auth.guard.spec.ts`:

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string>) {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('rejects a request with no Authorization header', async () => {
    const guard = new JwtAuthGuard(new JwtService({ secret: 'test' }));
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a malformed or invalid token', async () => {
    const guard = new JwtAuthGuard(new JwtService({ secret: 'test' }));
    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer not-a-token' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token and attaches the payload to the request', async () => {
    const jwtService = new JwtService({ secret: 'test' });
    const token = await jwtService.signAsync({ sub: 7, role: 'ADMIN' });
    const guard = new JwtAuthGuard(jwtService);
    const context = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user).toMatchObject({ sub: 7, role: 'ADMIN' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd libs/common && npm test -- jwt-auth.guard`
Expected: FAIL — `Cannot find module './jwt-auth.guard'`

- [ ] **Step 3: Implement the current-user decorator and the JWT guard**

`libs/common/src/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type Role = 'CUSTOMER' | 'ADMIN';

export interface AuthenticatedUser {
  sub: number;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    return data ? user?.[data] : user;
  },
);
```

`libs/common/src/guards/jwt-auth.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request.headers?.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(header?: string): string | undefined {
    if (!header) return undefined;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' ? token : undefined;
  }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd libs/common && npm test -- jwt-auth.guard`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing tests for the roles guard**

`libs/common/src/guards/roles.guard.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(user?: { role: string }) {
  const request: any = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request when the route declares no @Roles()', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows a user whose role is in the required list', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('rejects a user whose role is not in the required list', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: 'CUSTOMER' }))).toThrow(
      ForbiddenException,
    );
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `cd libs/common && npm test -- roles.guard`
Expected: FAIL — `Cannot find module './roles.guard'`

- [ ] **Step 7: Implement the roles decorator and guard**

`libs/common/src/decorators/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import type { Role } from './current-user.decorator';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

`libs/common/src/guards/roles.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser, Role } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this route');
    }

    return true;
  }
}
```

- [ ] **Step 8: Run it to see it pass**

Run: `cd libs/common && npm test -- roles.guard`
Expected: PASS (3 tests)

- [ ] **Step 9: Write the failing tests for the internal-key guard**

`libs/common/src/guards/internal-key.guard.spec.ts`:

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalKeyGuard } from './internal-key.guard';

function makeContext(headers: Record<string, string>) {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('InternalKeyGuard', () => {
  const OLD_ENV = process.env.INTERNAL_API_KEY;
  afterEach(() => {
    process.env.INTERNAL_API_KEY = OLD_ENV;
  });

  it('accepts a request carrying the expected key', () => {
    process.env.INTERNAL_API_KEY = 'secret-123';
    const guard = new InternalKeyGuard();
    expect(guard.canActivate(makeContext({ 'x-internal-key': 'secret-123' }))).toBe(
      true,
    );
  });

  it('rejects a request with a wrong key', () => {
    process.env.INTERNAL_API_KEY = 'secret-123';
    const guard = new InternalKeyGuard();
    expect(() => guard.canActivate(makeContext({ 'x-internal-key': 'wrong' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a request with no key header at all', () => {
    process.env.INTERNAL_API_KEY = 'secret-123';
    const guard = new InternalKeyGuard();
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 10: Run it to see it fail**

Run: `cd libs/common && npm test -- internal-key.guard`
Expected: FAIL — `Cannot find module './internal-key.guard'`

- [ ] **Step 11: Implement the internal-key guard**

`libs/common/src/guards/internal-key.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers?.['x-internal-key'];
    const expected = process.env.INTERNAL_API_KEY;

    if (!expected) {
      throw new Error(
        'INTERNAL_API_KEY is not set for this service; refusing to accept any x-internal-key',
      );
    }

    if (provided !== expected) {
      throw new UnauthorizedException('Missing or invalid x-internal-key');
    }

    return true;
  }
}
```

- [ ] **Step 12: Run it to see it pass**

Run: `cd libs/common && npm test -- internal-key.guard`
Expected: PASS (3 tests)

- [ ] **Step 13: Update the barrel file**

`libs/common/src/index.ts` (add to the file from Task 1):

```ts
export * from './guards/jwt-auth.guard';
export * from './guards/roles.guard';
export * from './guards/internal-key.guard';
export * from './decorators/roles.decorator';
export * from './decorators/current-user.decorator';
```

- [ ] **Step 14: Build and run the full suite**

Run: `cd libs/common && npm run build && npm test`
Expected: `dist/` rebuilt; all 18 tests pass (9 from Task 1 + 9 new).

- [ ] **Step 15: Commit**

```bash
git add libs/common
git commit -m "feat(common): add JWT, roles, and internal-key guards"
```

---

### Task 3: Wire `libs/common` into every app

**Files:**
- Modify: `apps/admin/package.json`, `apps/admin/src/main.ts`
- Modify: `apps/api-gateway/package.json`, `apps/api-gateway/src/main.ts`
- Modify: `apps/products/package.json`, `apps/products/src/main.ts`
- Modify: `apps/inventory/package.json`, `apps/inventory/src/main.ts`
- Modify: `apps/cart/package.json`, `apps/cart/src/main.ts`
- Modify: `apps/product-image/package.json`, `apps/product-image/src/main.ts`
- Modify: `apps/users/package.json`, `apps/users/src/main.ts`

**Interfaces:**
- Consumes: `AppValidationPipe`, `AllExceptionsFilter` from `@salescart/common` (Task 1).

- [ ] **Step 1: Add the dependency to every app**

In each of the 7 `apps/*/package.json` files, add to `"dependencies"`:

```json
"@salescart/common": "file:../../libs/common"
```

Then for each app, run (repeat for `admin`, `api-gateway`, `products`, `inventory`, `cart`, `product-image`, `users`):

```bash
cd apps/<name> && npm install
```

- [ ] **Step 2: Register the pipe and filter globally in each `main.ts`**

For every one of the 7 `main.ts` files, add the two imports and the two `app.use*` calls right after `NestFactory.create`. Example for `apps/products/src/main.ts` (the other 6 follow the same pattern — insert into the existing file, keep everything else, e.g. the Swagger setup in `products`/`cart`/`inventory`, unchanged):

```ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter, AppValidationPipe } from '@salescart/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Products API')
    .setDescription('Products service APIs')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
```

For `admin`, `api-gateway`, `product-image`, `users` (no Swagger block), the pattern is:

```ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter, AppValidationPipe } from '@salescart/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? <that app's own default from E0-2>);
}
bootstrap();
```

- [ ] **Step 3: Verify each app still boots**

For each of the 7 apps: `cd apps/<name> && npx nest start` (Ctrl+C after you see `Nest application successfully started` with 0 compile errors), or run the whole stack with `npm run start:all` from repo root and confirm all 7 ports still respond (see Task 7, Step 4, for the full-stack check — a per-app spot check here is enough to unblock the next task).

Expected: no compile errors, no missing-module errors for `@salescart/common`.

- [ ] **Step 4: Commit**

```bash
git add apps/*/package.json apps/*/package-lock.json apps/*/src/main.ts
git commit -m "feat: wire libs/common validation pipe and exception filter into every service"
```

---

### Task 4: TypeORM persistence for `products`

**Files:**
- Create: `apps/products/.env.example` (extend the one from E0-2)
- Create: `apps/products/src/database/data-source.ts`
- Create: `apps/products/src/database/migrations/1732000001000-CreateProducts.ts`
- Create: `apps/products/src/database/seed.ts`
- Create: `apps/products/src/products/entities/product.entity.ts`
- Modify: `apps/products/package.json`
- Modify: `apps/products/src/app.module.ts`
- Modify: `apps/products/src/products/products.module.ts`
- Modify: `apps/products/src/products/products.service.ts`
- Modify: `apps/products/src/products/products.controller.ts`
- Modify: `apps/products/src/products/products.service.spec.ts`
- Modify: `apps/products/src/products/products.controller.spec.ts`

**Interfaces:**
- Produces: `Product` entity (`id, name, description, category, spec, originalPrice, discountPrice, offers, images, isOutOfStock`), `ProductsService.getProducts(): Promise<Product[]>`, `getProductById(id: number): Promise<Product>`, `getProductsByIds(productIds: string): Promise<Product[]>`. Same method names/behavior as before — `cart`'s `products.client.ts` (Task 6) calls the HTTP route, not this service directly, so no cross-service signature to keep in sync.

- [ ] **Step 1: Add TypeORM dependencies**

In `apps/products/package.json`, add to `"dependencies"`:

```json
"@nestjs/typeorm": "^11.0.0",
"typeorm": "^0.3.20",
"pg": "^8.13.0"
```

And to `"scripts"`:

```json
"typeorm": "typeorm-ts-node-commonjs",
"migration:run": "npm run typeorm -- migration:run -d src/database/data-source.ts",
"migration:revert": "npm run typeorm -- migration:revert -d src/database/data-source.ts",
"seed": "ts-node -r tsconfig-paths/register src/database/seed.ts"
```

Run: `cd apps/products && npm install`

- [ ] **Step 2: Extend the env template**

`apps/products/.env.example` (replace the file created in E0-2):

```
PORT=3002

DB_HOST=localhost
DB_PORT=5432
DB_USER=salescart
DB_PASSWORD=salescart
DB_NAME=salescart
DB_SCHEMA=catalog
```

- [ ] **Step 3: Write the entity**

`apps/products/src/products/entities/product.entity.ts`:

```ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'products' })
export class Product {
  @PrimaryColumn('int')
  id!: number;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column('int')
  category!: number;

  @Column('jsonb')
  spec!: {
    name: string;
    brand: string;
    yearOfManufacture: Date;
    material: string;
  };

  @Column('numeric', {
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  originalPrice!: number;

  @Column('numeric', {
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  discountPrice!: number;

  @Column('jsonb', { default: () => "'[]'" })
  offers!: {
    bankCard: string;
    minPriceToApply: number;
    maxDiscount: number;
    discountPercentage: number;
  }[];

  @Column('jsonb', { default: () => "'[]'" })
  images!: string[];

  @Column({ default: false })
  isOutOfStock!: boolean;
}
```

- [ ] **Step 4: Write the data source and migration**

`apps/products/src/database/data-source.ts`:

```ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Product } from '../products/entities/product.entity';

export const productsDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'salescart',
  password: process.env.DB_PASSWORD ?? 'salescart',
  database: process.env.DB_NAME ?? 'salescart',
  schema: process.env.DB_SCHEMA ?? 'catalog',
  entities: [Product],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});

export default productsDataSource;
```

`apps/products/src/database/migrations/1732000001000-CreateProducts.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProducts1732000001000 implements MigrationInterface {
  name = 'CreateProducts1732000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "catalog"`);
    await queryRunner.query(`
      CREATE TABLE "catalog"."products" (
        "id" integer PRIMARY KEY,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "category" integer NOT NULL,
        "spec" jsonb NOT NULL,
        "originalPrice" numeric NOT NULL,
        "discountPrice" numeric NOT NULL,
        "offers" jsonb NOT NULL DEFAULT '[]',
        "images" jsonb NOT NULL DEFAULT '[]',
        "isOutOfStock" boolean NOT NULL DEFAULT false
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "catalog"."products"`);
  }
}
```

- [ ] **Step 5: Run the migration against the running Postgres container**

Prerequisite: `npm run start:infra` from repo root (Postgres must be up).

Run: `cd apps/products && npm run migration:run`
Expected: output ends with `CreateProducts1732000001000 has been executed successfully.` Verify with:

```bash
docker exec -it infra-postgres-1 psql -U salescart -d salescart -c "\dt catalog.*"
```

Expected: one row, `catalog.products`.

- [ ] **Step 6: Write the seed script and run it**

`apps/products/src/database/seed.ts`:

```ts
import 'dotenv/config';
import { productsDataSource } from './data-source';
import { Product } from '../products/entities/product.entity';
import { PRODUCTS } from '../products/data/products.data';

async function seed() {
  await productsDataSource.initialize();
  const repo = productsDataSource.getRepository(Product);

  for (const product of PRODUCTS) {
    await repo.upsert(product, ['id']);
  }

  console.log(`Seeded ${PRODUCTS.length} products.`);
  await productsDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

Run: `cd apps/products && npm run seed`
Expected: `Seeded 5 products.` Verify: `docker exec -it infra-postgres-1 psql -U salescart -d salescart -c "SELECT id, name FROM catalog.products ORDER BY id"` returns the 5 rows (101, 202, 303, 404, 505).

- [ ] **Step 7: Rewrite the service to use the repository**

`apps/products/src/products/products.service.ts`:

```ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  getProducts(): Promise<Product[]> {
    return this.products.find();
  }

  async getProductById(id: number): Promise<Product> {
    const product = await this.products.findOneBy({ id: +id });
    if (!product) {
      this.logger.warn(`Search failed: Product with ID ${id} not found.`);
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    this.logger.log(`Successfully fetched product: ${product.name}`);
    return product;
  }

  async getProductsByIds(productIds: string): Promise<Product[]> {
    if (!productIds) return [];

    const productArray = productIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');

    const ids = productArray.map((id) => Number(id));
    const products = await this.products.findBy({ id: In(ids) });

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
}
```

`apps/products/src/products/products.controller.ts` (only the return types change, to `Promise<...>`, since `ProductsService`'s methods are now async — Nest awaits a returned promise automatically either way, but the types must match for `tsc` to be happy):

```ts
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductDTO } from './dto/product.dto';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Query,
} from '@nestjs/common';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productService: ProductsService) {}
  private readonly logger = new Logger(ProductsController.name);

  @Get()
  @ApiOkResponse({ type: ProductDTO, isArray: true })
  getProducts(): Promise<Product[]> {
    return this.productService.getProducts();
  }

  @Get('bulk-by-product/')
  @ApiQuery({ name: 'productIds', required: true, example: '101,102' })
  @ApiOkResponse({ type: ProductDTO, isArray: true })
  getBulkInventory(@Query('productIds') productIds: string): Promise<Product[]> {
    this.isProductIdValid(productIds);
    return this.productService.getProductsByIds(productIds);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductDTO })
  getProductById(@Param('id') id: number): Promise<Product> {
    const productId = Number(id);
    if (isNaN(productId)) {
      this.logger.warn(`Invalid product id: ${id}`);
      throw new BadRequestException(`Invalid product id: ${id}`);
    }
    return this.productService.getProductById(productId);
  }

  isProductIdValid(productId) {
    const productReg = new RegExp(/^[0-9,]+$/);
    if (!productReg.test(productId)) {
      this.logger.warn(`Invalid Product Id ${productId}`);
      throw new BadRequestException(`Invalid Products ${productId}`);
    }
    return true;
  }
}
```

- [ ] **Step 8: Wire the module and app module**

`apps/products/src/products/products.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

`apps/products/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';
import { Product } from './products/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'salescart',
      password: process.env.DB_PASSWORD ?? 'salescart',
      database: process.env.DB_NAME ?? 'salescart',
      schema: process.env.DB_SCHEMA ?? 'catalog',
      entities: [Product],
      synchronize: false,
    }),
    ProductsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 9: Fix the generated unit tests to mock the repository**

`apps/products/src/products/products.service.spec.ts` (overwrite in full):

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  const repo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    findBy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repo },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a product by id', async () => {
    repo.findOneBy.mockResolvedValue({ id: 101, name: 'UltraBook Pro 15' });
    const result = await service.getProductById(101);
    expect(result.name).toBe('UltraBook Pro 15');
  });

  it('throws NotFoundException for a missing product id', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.getProductById(999)).rejects.toThrow(NotFoundException);
  });
});
```

`apps/products/src/products/products.controller.spec.ts` (overwrite in full):

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  const service = {
    getProducts: jest.fn(),
    getProductById: jest.fn(),
    getProductsByIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

- [ ] **Step 10: Run the tests**

Run: `cd apps/products && npm test`
Expected: PASS, all suites green.

- [ ] **Step 11: Verify against the running service**

```bash
cd apps/products && npx nest start
```

In another terminal: `curl http://localhost:3002/products` — expected: the 5 seeded products as JSON, same shape as before. `curl http://localhost:3002/products/999` — expected: `404` with `{"statusCode":404,"message":"Product with id 999 not found",...}` (via `AllExceptionsFilter` from Task 3). Stop the service, start it again, `curl` again — expected: same 5 products (proves persistence survives restart, per E0-4's acceptance criterion). Stop the service.

- [ ] **Step 12: Commit**

```bash
git add apps/products
git commit -m "feat(products): replace in-memory catalog with TypeORM persistence"
```

---

### Task 5: TypeORM persistence for `inventory`

**Files:**
- Create: `apps/inventory/.env.example`
- Create: `apps/inventory/src/database/data-source.ts`
- Create: `apps/inventory/src/database/migrations/1732000002000-CreateInventory.ts`
- Create: `apps/inventory/src/database/seed.ts`
- Create: `apps/inventory/src/inventory/entities/inventory-item.entity.ts`
- Modify: `apps/inventory/package.json`
- Modify: `apps/inventory/src/app.module.ts`
- Modify: `apps/inventory/src/inventory/inventory.module.ts`
- Modify: `apps/inventory/src/inventory/inventory.service.ts`
- Modify: `apps/inventory/src/inventory/inventory.service.spec.ts`
- Modify: `apps/inventory/src/inventory/inventory.controller.spec.ts`

**Interfaces:**
- Produces: `InventoryItem` entity (`productId` PK, `stock`, `isAvailable`). `InventoryService` keeps the exact same public method names/signatures as before (all now return `Promise<...>`), so `apps/cart/src/cart/exteranl/inventory.client.ts` (an HTTP client, unaffected) and `apps/inventory/src/inventory/inventory.controller.ts` (unchanged in this task) keep working.
- Fixes two pre-existing bugs while this file is being rewritten anyway (call this out in the commit message): (1) `updateInventoryByProduct` threw `NotFoundException` *inside* its own `try` block, so the outer `catch` always re-wrapped it as a `BadRequestException` — a 404 could never actually reach the client. (2) `updateInventoryStockByOrder`/`updateInventoryStockByCancel` wrapped their own intentional `BadRequestException` (insufficient stock) in another `BadRequestException`, mangling the message into `"[object Object]"`.

- [ ] **Step 1: Add TypeORM dependencies**

In `apps/inventory/package.json`, add to `"dependencies"`:

```json
"@nestjs/typeorm": "^11.0.0",
"typeorm": "^0.3.20",
"pg": "^8.13.0"
```

And to `"scripts"`:

```json
"typeorm": "typeorm-ts-node-commonjs",
"migration:run": "npm run typeorm -- migration:run -d src/database/data-source.ts",
"migration:revert": "npm run typeorm -- migration:revert -d src/database/data-source.ts",
"seed": "ts-node -r tsconfig-paths/register src/database/seed.ts"
```

Run: `cd apps/inventory && npm install`

- [ ] **Step 2: Extend the env template**

`apps/inventory/.env.example` (replace the file created in E0-2):

```
PORT=3003

DB_HOST=localhost
DB_PORT=5432
DB_USER=salescart
DB_PASSWORD=salescart
DB_NAME=salescart
DB_SCHEMA=inventory
```

- [ ] **Step 3: Write the entity**

`apps/inventory/src/inventory/entities/inventory-item.entity.ts`:

```ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'inventory' })
export class InventoryItem {
  @PrimaryColumn('int')
  productId!: number;

  @Column('int')
  stock!: number;

  @Column({ default: false })
  isAvailable!: boolean;
}
```

- [ ] **Step 4: Write the data source and migration**

`apps/inventory/src/database/data-source.ts`:

```ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

export const inventoryDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'salescart',
  password: process.env.DB_PASSWORD ?? 'salescart',
  database: process.env.DB_NAME ?? 'salescart',
  schema: process.env.DB_SCHEMA ?? 'inventory',
  entities: [InventoryItem],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});

export default inventoryDataSource;
```

`apps/inventory/src/database/migrations/1732000002000-CreateInventory.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventory1732000002000 implements MigrationInterface {
  name = 'CreateInventory1732000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "inventory"`);
    await queryRunner.query(`
      CREATE TABLE "inventory"."inventory" (
        "productId" integer PRIMARY KEY,
        "stock" integer NOT NULL,
        "isAvailable" boolean NOT NULL DEFAULT false
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inventory"."inventory"`);
  }
}
```

- [ ] **Step 5: Run the migration**

Run: `cd apps/inventory && npm run migration:run`
Expected: `CreateInventory1732000002000 has been executed successfully.` Verify: `docker exec -it infra-postgres-1 psql -U salescart -d salescart -c "\dt inventory.*"` shows `inventory.inventory`.

- [ ] **Step 6: Write and run the seed script**

`apps/inventory/src/database/seed.ts`:

```ts
import 'dotenv/config';
import { inventoryDataSource } from './data-source';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { INVENTORY } from '../data/inventory.data';

async function seed() {
  await inventoryDataSource.initialize();
  const repo = inventoryDataSource.getRepository(InventoryItem);

  for (const item of INVENTORY) {
    await repo.upsert(item, ['productId']);
  }

  console.log(`Seeded ${INVENTORY.length} inventory rows.`);
  await inventoryDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

Run: `cd apps/inventory && npm run seed`
Expected: `Seeded 3 inventory rows.`

- [ ] **Step 7: Rewrite the service to use the repository**

`apps/inventory/src/inventory/inventory.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  INVENTORY_NOT_FOUND,
  PRODUCT_NOT_FOUND_TO_UPDATE,
  PRODUCT_UPDATED_SUCCESSFULLY,
} from '../constants/inventory.constants';
import {
  InventoryDTO,
  InventoryOrderPlacedOrCancelDTO,
  InventoryUpdateDTO,
  UpdateInventoryByProductIdDTO,
} from '../dto/inventory.dto';
import { InventoryItem } from './entities/inventory-item.entity';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventory: Repository<InventoryItem>,
  ) {}

  private mapToDto(item: InventoryItem): InventoryDTO {
    return {
      productId: item.productId,
      stock: item.stock,
      isAvailable: item.stock > 0,
    };
  }

  async getFullInventory(): Promise<InventoryDTO[]> {
    const items = await this.inventory.find();
    return items.map((item) => this.mapToDto(item));
  }

  async getInventoryByProductId(productId: number): Promise<InventoryDTO> {
    const item = await this.inventory.findOneBy({ productId: +productId });
    if (!item) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    return this.mapToDto(item);
  }

  async getInventoryByProductIds(productIds: string): Promise<InventoryDTO[]> {
    if (!productIds) return [];

    const productArray = productIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');

    const ids = productArray.map((id) => Number(id));
    const items = await this.inventory.findBy({ productId: In(ids) });

    if (items.length === 0) {
      this.logger.warn(`${INVENTORY_NOT_FOUND} ${productIds}`);
      throw new NotFoundException(`${INVENTORY_NOT_FOUND} ${productIds}`);
    }

    if (productArray.length !== items.length) {
      this.logger.warn(
        `Missing products: requested ${productArray.length}, found ${items.length}`,
      );
    }

    return items.map((item) => this.mapToDto(item));
  }

  async addNewProductToInventory(addInventory: InventoryUpdateDTO): Promise<string> {
    await this.inventory.save(
      this.inventory.create({
        productId: addInventory.productId,
        stock: addInventory.stock,
        isAvailable: addInventory.stock > 0,
      }),
    );
    return 'Inventory Updated succesfully';
  }

  async updateInventoryByProduct(
    productId: string,
    updateInventory: UpdateInventoryByProductIdDTO,
  ): Promise<string> {
    const item = await this.inventory.findOneBy({ productId: +productId });

    if (!item) {
      this.logger.warn(`${PRODUCT_NOT_FOUND_TO_UPDATE} : ${productId}`);
      throw new NotFoundException(`${PRODUCT_NOT_FOUND_TO_UPDATE} : ${productId}`);
    }

    item.stock = updateInventory.stock;
    item.isAvailable = updateInventory.stock > 0;
    await this.inventory.save(item);
    this.logger.log(
      `${PRODUCT_UPDATED_SUCCESSFULLY} ProductID: ${productId} Payload: ${JSON.stringify(updateInventory)}`,
    );
    return `${PRODUCT_UPDATED_SUCCESSFULLY}`;
  }

  async updateInventoryStockByOrder(
    orderedProducts: InventoryOrderPlacedOrCancelDTO,
  ): Promise<boolean> {
    const items = await this.inventory.find();
    for (const item of items) {
      const order = orderedProducts.items[item.productId];
      if (order) {
        if (item.stock < order.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}`,
          );
        }
        item.stock -= order.quantity;
        item.isAvailable = item.stock > 0;
        await this.inventory.save(item);
      }
    }
    return true;
  }

  async updateInventoryStockByCancel(
    cancelledProducts: InventoryOrderPlacedOrCancelDTO,
  ): Promise<boolean> {
    const items = await this.inventory.find();
    for (const item of items) {
      const order = cancelledProducts.items[item.productId];
      if (order) {
        item.stock += order.quantity;
        item.isAvailable = item.stock > 0;
        await this.inventory.save(item);
      }
    }
    return true;
  }
}
```

(The controller, `apps/inventory/src/inventory/inventory.controller.ts`, is unchanged — every call site already just `return`s the service call, and Nest awaits a returned promise whether the method is `async` or not, and none of its own return-type annotations are `boolean`/synchronous in a way that would now conflict.)

- [ ] **Step 8: Wire the module and app module**

`apps/inventory/src/inventory/inventory.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem])],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
```

`apps/inventory/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryItem } from './inventory/entities/inventory-item.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'salescart',
      password: process.env.DB_PASSWORD ?? 'salescart',
      database: process.env.DB_NAME ?? 'salescart',
      schema: process.env.DB_SCHEMA ?? 'inventory',
      entities: [InventoryItem],
      synchronize: false,
    }),
    InventoryModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 9: Fix the generated unit tests to mock the repository**

`apps/inventory/src/inventory/inventory.service.spec.ts` (overwrite in full — read the file first to confirm its current provider setup, then replace it with):

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';

describe('InventoryService', () => {
  let service: InventoryService;
  const repo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    findBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn((v) => v),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryItem), useValue: repo },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws NotFoundException for a missing product id', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.getInventoryByProductId(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects an order that exceeds available stock', async () => {
    repo.find.mockResolvedValue([{ productId: 101, stock: 2, isAvailable: true }]);
    await expect(
      service.updateInventoryStockByOrder({ items: { 101: { quantity: 5 } } }),
    ).rejects.toThrow(BadRequestException);
  });

  it('surfaces the original 404 instead of wrapping it as a 400', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(
      service.updateInventoryByProduct('101', { stock: 5, isAvailable: true }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

`apps/inventory/src/inventory/inventory.controller.spec.ts`: read the current file; if it instantiates `InventoryController` without providing `InventoryService`, add `providers: [{ provide: InventoryService, useValue: { getFullInventory: jest.fn(), getInventoryByProductId: jest.fn(), getInventoryByProductIds: jest.fn(), updateInventoryStockByOrder: jest.fn(), updateInventoryStockByCancel: jest.fn(), updateInventoryByProduct: jest.fn(), addNewProductToInventory: jest.fn() } }]` to the `Test.createTestingModule({ controllers: [...] })` call, matching the pattern used for `products.controller.spec.ts` in Task 4.

- [ ] **Step 10: Run the tests**

Run: `cd apps/inventory && npm test`
Expected: PASS, all suites green.

- [ ] **Step 11: Verify against the running service**

```bash
cd apps/inventory && npx nest start
```

`curl http://localhost:3003/inventory` — expected: the 3 seeded rows. `curl -X PATCH http://localhost:3003/inventory/999 -H "Content-Type: application/json" -d "{\"stock\":5,\"isAvailable\":true}"` — expected: now a real `404` (the bug fix from Step 7), not a `400`. Stop the service.

- [ ] **Step 12: Commit**

```bash
git add apps/inventory
git commit -m "feat(inventory): replace in-memory stock with TypeORM persistence, fix 404-vs-400 bug"
```

---

### Task 6: TypeORM persistence for `cart`

**Files:**
- Create: `apps/cart/.env.example`
- Create: `apps/cart/src/database/data-source.ts`
- Create: `apps/cart/src/database/migrations/1732000003000-CreateCartItems.ts`
- Create: `apps/cart/src/cart/entities/cart-item.entity.ts`
- Modify: `apps/cart/package.json`
- Modify: `apps/cart/src/app.module.ts`
- Modify: `apps/cart/src/cart/cart.module.ts`
- Modify: `apps/cart/src/cart/cart.service.ts`
- Modify: `apps/cart/src/cart/cart.controller.ts`
- Modify: `apps/cart/src/cart/cart.service.spec.ts`
- Modify: `apps/cart/src/cart/cart.controller.spec.ts`

**Interfaces:**
- Produces: `CartItem` entity (`id` PK, `userId`, `productId`, `quantity`, unique on `(userId, productId)`). `CartService` keeps the same public method names, all now `Promise`-returning.
- Fixes a pre-existing bug while this file is being rewritten anyway (call out in the commit message): `CartController.deleteCartByUserid` never `return`ed the service call, so the response could be sent before the delete finished, and the client got an empty body even on success. Fixed by returning the (now-awaited) promise like the other three mutating routes already do.
- No seed script — a cart starts empty for every user; there is nothing to seed.

- [ ] **Step 1: Add TypeORM dependencies**

In `apps/cart/package.json`, add to `"dependencies"`:

```json
"@nestjs/typeorm": "^11.0.0",
"typeorm": "^0.3.20",
"pg": "^8.13.0"
```

And to `"scripts"`:

```json
"typeorm": "typeorm-ts-node-commonjs",
"migration:run": "npm run typeorm -- migration:run -d src/database/data-source.ts",
"migration:revert": "npm run typeorm -- migration:revert -d src/database/data-source.ts"
```

Run: `cd apps/cart && npm install`

- [ ] **Step 2: Extend the env template**

`apps/cart/.env.example` (replace the file created in E0-2):

```
PORT=3004

# Downstream services this service calls directly (service-to-service HTTP).
PRODUCTS_URL=http://localhost:3002/products
INVENTORY_URL=http://localhost:3003/inventory

DB_HOST=localhost
DB_PORT=5432
DB_USER=salescart
DB_PASSWORD=salescart
DB_NAME=salescart
DB_SCHEMA=cart
```

- [ ] **Step 3: Write the entity**

`apps/cart/src/cart/entities/cart-item.entity.ts`:

```ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'cart_items' })
@Unique(['userId', 'productId'])
export class CartItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('int')
  userId!: number;

  @Column('int')
  productId!: number;

  @Column('int')
  quantity!: number;
}
```

- [ ] **Step 4: Write the data source and migration**

`apps/cart/src/database/data-source.ts`:

```ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { CartItem } from '../cart/entities/cart-item.entity';

export const cartDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'salescart',
  password: process.env.DB_PASSWORD ?? 'salescart',
  database: process.env.DB_NAME ?? 'salescart',
  schema: process.env.DB_SCHEMA ?? 'cart',
  entities: [CartItem],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});

export default cartDataSource;
```

`apps/cart/src/database/migrations/1732000003000-CreateCartItems.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCartItems1732000003000 implements MigrationInterface {
  name = 'CreateCartItems1732000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "cart"`);
    await queryRunner.query(`
      CREATE TABLE "cart"."cart_items" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "productId" integer NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "UQ_cart_user_product" UNIQUE ("userId", "productId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cart"."cart_items"`);
  }
}
```

- [ ] **Step 5: Run the migration**

Run: `cd apps/cart && npm run migration:run`
Expected: `CreateCartItems1732000003000 has been executed successfully.` Verify: `docker exec -it infra-postgres-1 psql -U salescart -d salescart -c "\dt cart.*"` shows `cart.cart_items`.

- [ ] **Step 6: Rewrite the service to use the repository**

`apps/cart/src/cart/cart.service.ts`:

```ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CART_EMPTY,
  CART_REMOVED_SUCCESFULLY,
  CART_UPDATE_SUCCESFULLY,
  PRODUCT_NOT_AVAILABLE,
} from './constants/cart.constants';
import { CartAddRemoveDTO, CartDTO, CartResponseDto } from './dto/cart.dto';
import { getProductsByIds } from './exteranl/products.client';
import { getInventoryByIds } from './exteranl/inventory.client';
import { CartItem } from './entities/cart-item.entity';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(CartItem) private readonly cartItems: Repository<CartItem>,
  ) {}

  async getCartByUserId(userId: number): Promise<CartItem[]> {
    const cart = await this.cartItems.findBy({ userId: +userId });
    if (cart.length === 0) {
      this.logger.error(`${CART_EMPTY}`);
    }
    return cart;
  }

  async getCart(userId: number): Promise<CartResponseDto> {
    const cart = await this.getCartByUserId(userId);
    const productIds = cart.map((i) => i.productId);

    const results = await Promise.allSettled([
      getProductsByIds(productIds),
      getInventoryByIds(productIds),
    ]);
    if (results[0].status === 'rejected') {
      this.logger.error('Products service failed');
    }
    if (results[1].status === 'rejected') {
      this.logger.error('Inventory service failed');
    }
    const products = results[0].status === 'fulfilled' ? results[0].value : [];
    const inventory = results[1].status === 'fulfilled' ? results[1].value : [];

    const items = cart.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const stock = inventory.find((i) => i.productId === item.productId);

      return {
        productId: item.productId,
        quantity: item.quantity,
        name: product?.name ?? 'Unavailable',
        price: product?.discountPrice ?? product?.originalPrice ?? 0,
        isAvailable: stock?.isAvailable ?? false,
      };
    });

    return { userId, items };
  }

  async addProductToCart(cartAdd: CartAddRemoveDTO): Promise<string> {
    if (!(cartAdd.quantity > 0)) {
      throw new BadRequestException('Quantity must be greater than 0');
    }
    const existing = await this.cartItems.findOneBy({
      userId: cartAdd.userId,
      productId: cartAdd.productId,
    });
    if (existing) {
      existing.quantity += cartAdd.quantity;
      await this.cartItems.save(existing);
    } else {
      await this.cartItems.save(
        this.cartItems.create({
          userId: cartAdd.userId,
          productId: cartAdd.productId,
          quantity: cartAdd.quantity,
        }),
      );
    }
    return `${CART_UPDATE_SUCCESFULLY}`;
  }

  async updateQuantityByProduct(
    userId: number,
    data: CartAddRemoveDTO,
  ): Promise<string> {
    const cart = await this.cartItems.findOneBy({
      userId: +userId,
      productId: data.productId,
    });

    if (!cart) {
      this.logger.warn(`${PRODUCT_NOT_AVAILABLE}`);
      throw new BadRequestException(`${PRODUCT_NOT_AVAILABLE}`);
    }

    cart.quantity += data.quantity;
    if (cart.quantity <= 0) {
      await this.cartItems.remove(cart);
    } else {
      await this.cartItems.save(cart);
    }

    return CART_UPDATE_SUCCESFULLY;
  }

  async deleteCartByUserid(userId: number): Promise<string> {
    await this.cartItems.delete({ userId: +userId });
    return CART_REMOVED_SUCCESFULLY;
  }

  async deleteCartByproductId(userId: number, productId: number): Promise<CartDTO[]> {
    await this.cartItems.delete({ userId: +userId, productId: +productId });
    return this.cartItems.findBy({ userId: +userId });
  }
}
```

`apps/cart/src/cart/cart.controller.ts` (return types updated to `Promise<...>`, and `deleteCartByUserid` now `return`s — this is the bug fix called out above):

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { ApiOkResponse } from '@nestjs/swagger';
import { CartAddRemoveDTO, CartDTO, CartResponseDto } from './dto/cart.dto';
import {
  INVALID_PRODUCT_ID,
  INVALID_USER_ID,
} from './constants/cart.constants';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}
  private readonly logger = new Logger(CartController.name);

  @Get(':userId')
  @ApiOkResponse({ type: CartResponseDto })
  async getCartByUserId(
    @Param('userId') userId: number,
  ): Promise<CartResponseDto> {
    if (isNaN(userId)) {
      this.logger.warn(`${INVALID_PRODUCT_ID} ${userId}`);
      throw new BadRequestException(`${INVALID_PRODUCT_ID} ${userId}`);
    }
    return await this.cartService.getCart(userId);
  }

  @Post()
  @ApiOkResponse({ description: 'Product added to cart' })
  addProductToCart(@Body() cartAdd: CartAddRemoveDTO): Promise<string> {
    return this.cartService.addProductToCart(cartAdd);
  }

  @Patch('updateQuantityByProduct/:userId')
  @ApiOkResponse({ description: 'Product in cart Updated succesfully' })
  updateQuantityByProduct(
    @Param('userId') userId: number,
    @Body() data: CartAddRemoveDTO,
  ): Promise<string> {
    if (isNaN(userId)) {
      this.logger.warn(`${INVALID_USER_ID} ${userId}`);
      throw new BadRequestException(`${INVALID_USER_ID} ${userId}`);
    }
    return this.cartService.updateQuantityByProduct(userId, data);
  }

  @Delete('deleteCartByUserid/:userId')
  @ApiOkResponse({ description: 'Cart Delete succesfully' })
  deleteCartByUserid(@Param('userId') userId: number): Promise<string> {
    if (isNaN(userId)) {
      this.logger.warn(`${INVALID_PRODUCT_ID} ${userId}`);
      throw new BadRequestException(`${INVALID_PRODUCT_ID} ${userId}`);
    }
    return this.cartService.deleteCartByUserid(userId);
  }

  @Delete('deleteCartByproductId/:userId/:productId')
  @ApiOkResponse({ description: 'Cart Delete succesfully' })
  deleteCartByproductId(
    @Param('userId') userId: number,
    @Param('productId') productId: number,
  ): Promise<CartDTO[]> {
    if (isNaN(userId)) {
      this.logger.warn(`${INVALID_USER_ID} ${userId}`);
      throw new BadRequestException(`${INVALID_USER_ID} ${userId}`);
    }
    if (isNaN(productId)) {
      this.logger.warn(`${INVALID_PRODUCT_ID} ${productId}`);
      throw new BadRequestException(`${INVALID_PRODUCT_ID} ${productId}`);
    }
    return this.cartService.deleteCartByproductId(userId, productId);
  }
}
```

- [ ] **Step 7: Wire the module and app module**

`apps/cart/src/cart/cart.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CartItem])],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
```

`apps/cart/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartModule } from './cart/cart.module';
import { CartItem } from './cart/entities/cart-item.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'salescart',
      password: process.env.DB_PASSWORD ?? 'salescart',
      database: process.env.DB_NAME ?? 'salescart',
      schema: process.env.DB_SCHEMA ?? 'cart',
      entities: [CartItem],
      synchronize: false,
    }),
    CartModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Fix the generated unit tests to mock the repository**

`apps/cart/src/cart/cart.service.spec.ts` (read the current file first, then overwrite in full):

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';

describe('CartService', () => {
  let service: CartService;
  const repo = {
    find: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn((v) => v),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(CartItem), useValue: repo },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects adding a non-positive quantity', async () => {
    await expect(
      service.addProductToCart({ userId: 1, productId: 101, quantity: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('merges quantity into an existing line instead of duplicating it', async () => {
    repo.findOneBy.mockResolvedValue({ userId: 1, productId: 101, quantity: 2 });
    await service.addProductToCart({ userId: 1, productId: 101, quantity: 3 });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 5 }),
    );
  });
});
```

`apps/cart/src/cart/cart.controller.spec.ts`: read the current file; if it instantiates `CartController` without providing `CartService`, add `providers: [{ provide: CartService, useValue: { getCart: jest.fn(), addProductToCart: jest.fn(), updateQuantityByProduct: jest.fn(), deleteCartByUserid: jest.fn(), deleteCartByproductId: jest.fn() } }]` to the `Test.createTestingModule({ controllers: [...] })` call, matching the pattern used in Task 4.

- [ ] **Step 9: Run the tests**

Run: `cd apps/cart && npm test`
Expected: PASS, all suites green.

- [ ] **Step 10: Verify against the running stack**

Prerequisite: `products` and `inventory` running (Task 4/5, Step 11 — or `npm run start:all` from repo root).

```bash
cd apps/cart && npx nest start
```

`curl -X POST http://localhost:3004/cart -H "Content-Type: application/json" -d "{\"userId\":1,\"productId\":101,\"quantity\":2}"` — expected: `"Cart updated succesfully"`. `curl http://localhost:3004/cart/1` — expected: one item, `productId: 101, quantity: 2`, with `name`/`price` populated from the live `products` service. `curl -X DELETE http://localhost:3004/cart/deleteCartByUserid/1` — expected: now returns `"Cart remove sucessfully"` in the body (previously empty, per the bug fix). Stop the service.

- [ ] **Step 11: Commit**

```bash
git add apps/cart
git commit -m "feat(cart): replace in-memory cart with TypeORM persistence, fix missing-return bug"
```

---

### Task 7: Root scripts and full-stack verification

**Files:**
- Modify: `package.json` (repo root)
- Modify: `docs/sprint-1.md`

**Interfaces:**
- Consumes: `build`/`test` scripts already present in every app's own `package.json` (products/inventory/cart from Tasks 4–6; admin/api-gateway/product-image/users/libs/common already had `test`/`build` — libs/common's from Task 1).

- [ ] **Step 1: Add build/test scripts to the root `package.json`**

Add these entries to `"scripts"` (alongside the existing `start:*`):

```json
"build:common": "cmd /c \"cd libs/common && npm run build\"",
"test:common": "cmd /c \"cd libs/common && npm test\"",
"build:products": "cmd /c \"cd apps/products && npm run build\"",
"build:inventory": "cmd /c \"cd apps/inventory && npm run build\"",
"build:cart": "cmd /c \"cd apps/cart && npm run build\"",
"build:admin": "cmd /c \"cd apps/admin && npm run build\"",
"build:api-gateway": "cmd /c \"cd apps/api-gateway && npm run build\"",
"build:users": "cmd /c \"cd apps/users && npm run build\"",
"build:product-image": "cmd /c \"cd apps/product-image && npm run build\"",
"build:all": "npm run build:common && concurrently \"npm run build:products\" \"npm run build:inventory\" \"npm run build:cart\" \"npm run build:admin\" \"npm run build:api-gateway\" \"npm run build:users\" \"npm run build:product-image\"",
"test:products": "cmd /c \"cd apps/products && npm test\"",
"test:inventory": "cmd /c \"cd apps/inventory && npm test\"",
"test:cart": "cmd /c \"cd apps/cart && npm test\"",
"test:admin": "cmd /c \"cd apps/admin && npm test\"",
"test:api-gateway": "cmd /c \"cd apps/api-gateway && npm test\"",
"test:users": "cmd /c \"cd apps/users && npm test\"",
"test:product-image": "cmd /c \"cd apps/product-image && npm test\"",
"test:all": "npm run test:common && concurrently \"npm run test:products\" \"npm run test:inventory\" \"npm run test:cart\" \"npm run test:admin\" \"npm run test:api-gateway\" \"npm run test:users\" \"npm run test:product-image\"",
"migrate:products": "cmd /c \"cd apps/products && npm run migration:run\"",
"migrate:inventory": "cmd /c \"cd apps/inventory && npm run migration:run\"",
"migrate:cart": "cmd /c \"cd apps/cart && npm run migration:run\"",
"migrate:all": "npm run migrate:products && npm run migrate:inventory && npm run migrate:cart"
```

- [ ] **Step 2: Run `test:all` and `build:all` from a clean state**

Run: `npm run test:all`
Expected: all 8 suites (`common` + 7 apps) pass.

Run: `npm run build:all`
Expected: every app's `dist/` is produced with no `tsc` errors, `libs/common` builds first.

- [ ] **Step 3: Full-stack restart-survives-persistence check**

```bash
npm run start:infra
npm run migrate:all
npm run seed:products    # from Task 4's package.json script
npm run seed:inventory   # from Task 5's package.json script — add this line to root package.json's scripts too: "seed:products": "cmd /c \"cd apps/products && npm run seed\"", "seed:inventory": "cmd /c \"cd apps/inventory && npm run seed\""
npm run start:all
```

Wait for all 7 services to report `Nest application successfully started`, then:

```bash
curl http://localhost:3002/products      # 5 products
curl http://localhost:3003/inventory     # 3 inventory rows
curl -X POST http://localhost:3004/cart -H "Content-Type: application/json" -d "{\"userId\":9,\"productId\":101,\"quantity\":1}"
curl http://localhost:3004/cart/9        # 1 item
```

Stop every service (kill the full `npm run start:all` process tree, not just the listening children — the `nest start --watch` supervisor respawns a killed child, so kill from the root `npm` PID down). Start `npm run start:all` again. Repeat the four `curl` calls above.

Expected: identical results both times — proves E0-4's "data survives restart" criterion. Then `npm run start:infra` down (`docker-compose -f infra/docker-compose.yml down`) and stop all Node processes, leaving the machine clean.

- [ ] **Step 4: Mark the stories done**

In `docs/sprint-1.md`, change:
```
| E0-3 | [ ] `libs/common`: ...
| E0-4 | [ ] Replace in-memory data ...
| E0-5 | [ ] Root scripts: ...
```
to `[x]` for all three.

- [ ] **Step 5: Commit**

```bash
git add package.json docs/sprint-1.md
git commit -m "feat: add root build:all/test:all/migrate:all scripts, complete EPIC 0"
```

---

## Self-Review Notes (for the plan author, not a task to execute)

- **Spec coverage:** E0-3 → Tasks 1–3. E0-4 → Tasks 4–6. E0-5 → Task 7. E0-1 and E0-2 were already done before this plan. All of EPIC 0 is covered.
- **Deferred on purpose:** `libs/common`'s guards are not yet applied to any controller — `JwtAuthGuard`/`RolesGuard` need a login endpoint to issue tokens first (E1-2), and `InternalKeyGuard` needs the gateway to start sending the header first (E6-1). Applying them earlier would lock routes with no way to pass them, breaking every `curl` smoke test in this plan. The next plan (Identity / E1) picks this up.
- **Out of scope on purpose:** row-locking / transactional atomicity for stock reservation is E3-3's job, not this plan's — `updateInventoryStockByOrder` here is a straightforward loop, not yet safe against concurrent orders.
