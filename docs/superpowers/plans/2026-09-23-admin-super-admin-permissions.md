# Super Admin & Per-Screen Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `SUPER_ADMIN` role that can create/remove `ADMIN` accounts and grant each one whole-screen access (Products, Categories, Inventory, Orders), enforced at the gateway — the one place every `/admin/*` request already passes through.

**Architecture:** `Role` gains `SUPER_ADMIN`; the seeded bootstrap account becomes `SUPER_ADMIN` instead of `ADMIN`. Screen permissions are carried as a `permissions: string[] | null` claim embedded in the JWT at sign time (users service) and checked entirely at the gateway (api-gateway) against a `screen` tag on each `RouteRule` — no changes needed in the 5 downstream services beyond widening their `@Roles(Role.ADMIN)` decorators to also accept `SUPER_ADMIN`. A new `AdminUsersController` (users service, `SUPER_ADMIN`-only) manages admin accounts; admin-web gets a permission-aware nav and a new Admin Users screen.

**Tech Stack:** NestJS + TypeORM (Postgres) for `apps/users` and `apps/api-gateway`; React + Vite for `apps/admin-web`; Jest for backend unit tests.

**Spec:** `docs/superpowers/specs/2026-09-23-admin-super-admin-permissions-design.md`

## Global Constraints

- Promoting an account to `SUPER_ADMIN`, or creating a second one, is never exposed through any UI or endpoint in this plan — manual/DB action only. `POST /admin/users` always creates role `ADMIN`.
- Whole-screen toggle only — no view/edit granularity within a screen.
- The valid screen names are exactly `products`, `categories`, `inventory`, `orders` — matching admin-web's current nav items one-to-one. `/upload` (product-image) stays `admin`-tier gated with no `screen` tag — the spec's screen list doesn't include it, and it isn't its own nav item.
- JWTs are stateless with a 1-hour TTL and no revocation mechanism anywhere in this app; a permission change or removal takes effect on the affected admin's next login, not immediately. This plan does not add revocation — that's an accepted, pre-existing tradeoff, not a new one.
- Migrations are raw SQL via `QueryRunner.query`, matching every existing migration in this repo — no `synchronize: true`, ever.

## Review Focus

- **A `CUSTOMER` or unauthenticated token hitting a screen-tagged admin route** — the new per-screen check must never *weaken* the existing base role check; a non-admin still gets 401/403 before the screen check is ever reached.
- **A `SUPER_ADMIN` token with no `permissions` claim at all** (it never has one) hitting a screen-tagged route — must bypass the screen check entirely, not be treated as "has no permissions, deny".
- **An `ADMIN` calling `DELETE /admin/users/:id` on their own id** — must be rejected before any DB lookup, not fall through to "not found" or succeed.
- **Creating an admin with an unknown/invalid string in `permissions`** (typo, old screen name) — must 400 at the DTO boundary, never silently accepted or silently dropped.
- **`PATCH /admin/users/:id/permissions` targeting a `SUPER_ADMIN`'s own id** — must 404 ("not an admin account"), never silently succeed and leave a super admin with a bogus restricted-permissions value.

---

## Task 1: `SUPER_ADMIN` role + widen ADMIN-tier role checks

**Files:**
- Modify: `libs/common/src/enums/role.enum.ts`
- Modify: `apps/api-gateway/src/gateway/gateway-auth.ts`
- Modify: `apps/api-gateway/src/gateway/gateway-auth.spec.ts`
- Modify: `apps/inventory/src/inventory/admin-inventory.controller.ts`
- Modify: `apps/orders/src/orders/admin-orders.controller.ts`
- Modify: `apps/product-image/src/media/media.controller.ts`
- Modify: `apps/products/src/categories/admin-categories.controller.ts`
- Modify: `apps/products/src/products/admin-products.controller.ts`

**Interfaces:**
- Produces: `Role.SUPER_ADMIN` (new enum member, value `'SUPER_ADMIN'`) — consumed by every later task in this plan.

- [ ] **Step 1: Write the failing test**

In `apps/api-gateway/src/gateway/gateway-auth.spec.ts`, add this test right after the existing `'accepts an admin token on an admin route'` test:

```ts
  it('accepts a super admin token on an admin route with no permissions claim at all', () => {
    const token = jwt.sign({ sub: 1, role: 'SUPER_ADMIN' }, 'test-secret');
    const req = fakeReq({ authorization: `Bearer ${token}` }, '/admin/orders');

    expect(() => checkAuth(req, '/admin/orders')).not.toThrow();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api-gateway && npx jest gateway-auth.spec.ts -t "super admin token"`
Expected: FAIL — `Role.SUPER_ADMIN` doesn't exist yet, and `checkAuth` still rejects any role other than exactly `'ADMIN'` on an `admin`-tier route (403).

- [ ] **Step 3: Implement**

Replace `libs/common/src/enums/role.enum.ts`'s contents with:

```ts
export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
```

In `apps/api-gateway/src/gateway/gateway-auth.ts`, replace:

```ts
  if (route.auth === 'admin' && payload.role !== 'ADMIN') {
    throw new GatewayHttpError(403, 'Forbidden', 'Insufficient role for this action');
  }
```

with:

```ts
  if (route.auth === 'admin' && payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    throw new GatewayHttpError(403, 'Forbidden', 'Insufficient role for this action');
  }
```

In each of these 5 files, replace the line `@Roles(Role.ADMIN)` with `@Roles(Role.ADMIN, Role.SUPER_ADMIN)` (the `Role` and `Roles` imports are already present in every one of them — no import changes needed):
- `apps/inventory/src/inventory/admin-inventory.controller.ts`
- `apps/orders/src/orders/admin-orders.controller.ts`
- `apps/product-image/src/media/media.controller.ts`
- `apps/products/src/categories/admin-categories.controller.ts`
- `apps/products/src/products/admin-products.controller.ts`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api-gateway && npx jest gateway-auth.spec.ts`
Expected: PASS — all tests in the file, including the new one.

- [ ] **Step 5: Rebuild `libs/common` and typecheck every affected service**

`libs/common` is consumed by the other services as a packed tarball (`file:../../libs/common/salescart-common-0.1.2.tgz` in their `package.json`), not a live workspace link — a change to it needs repacking before other services see it.

Run: `cd libs/common && npx jest`
Expected: PASS — confirms the enum addition didn't break any of `libs/common`'s own guard/decorator tests before it gets packed and consumed elsewhere.

Run: `cd libs/common && npm run build && npm pack`
Expected: produces `salescart-common-0.1.2.tgz` (or check `libs/common/package.json`'s `version` field for the exact current filename if this fails — use whatever version is there).

Then reinstall it into every service whose `package.json` references that tarball, so the new `Role.SUPER_ADMIN` member is actually picked up:

Run (repeat for `apps/api-gateway`, `apps/users`, `apps/inventory`, `apps/orders`, `apps/product-image`, `apps/products`): `cd apps/<service> && npm install`

Then typecheck each: `cd apps/<service> && npx tsc --noEmit`
Expected: no errors in any of them.

- [ ] **Step 6: Commit**

```bash
git add libs/common/src/enums/role.enum.ts apps/api-gateway/src/gateway/gateway-auth.ts apps/api-gateway/src/gateway/gateway-auth.spec.ts apps/inventory/src/inventory/admin-inventory.controller.ts apps/orders/src/orders/admin-orders.controller.ts apps/product-image/src/media/media.controller.ts apps/products/src/categories/admin-categories.controller.ts apps/products/src/products/admin-products.controller.ts
git commit -m "auth: add SUPER_ADMIN role, accepted everywhere ADMIN is"
```

Note: if `libs/common`'s packed tarball changed, its `package-lock.json`/`node_modules` diffs in each consuming service are a normal side effect of Step 5 — include whatever `git status` shows changed in those services' lockfiles in this commit too (`git add apps/*/package-lock.json` for the services touched above, if changed).

---

## Task 2: JWT `permissions` claim + gateway screen enforcement

**Files:**
- Modify: `apps/api-gateway/src/gateway/gateway.routes.ts`
- Modify: `apps/api-gateway/src/gateway/gateway.routes.spec.ts`
- Modify: `apps/api-gateway/src/gateway/gateway-auth.ts`
- Modify: `apps/api-gateway/src/gateway/gateway-auth.spec.ts`
- Modify: `apps/users/src/users/auth.service.ts`

**Interfaces:**
- Consumes: `Role.SUPER_ADMIN` (Task 1).
- Produces: `RouteRule.screen?: string`; `AuthService.signToken(user: { id, role, email, permissions?: string[] | null })` — the JWT payload gains a `permissions` claim, consumed by `checkAuth`'s new screen check (this task) and by Task 3's `UsersService.login`.

- [ ] **Step 1: Write the failing tests**

In `apps/api-gateway/src/gateway/gateway-auth.spec.ts`, add these two tests after the one added in Task 1:

```ts
  it('rejects an admin token missing the route\'s screen permission', () => {
    const token = jwt.sign({ sub: 1, role: 'ADMIN', permissions: ['orders'] }, 'test-secret');
    const req = fakeReq({ authorization: `Bearer ${token}` }, '/admin/products');

    try {
      checkAuth(req, '/admin/products');
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayHttpError);
      expect((err as GatewayHttpError).statusCode).toBe(403);
    }
  });

  it('accepts an admin token that has the route\'s screen permission', () => {
    const token = jwt.sign({ sub: 1, role: 'ADMIN', permissions: ['products', 'orders'] }, 'test-secret');
    const req = fakeReq({ authorization: `Bearer ${token}` }, '/admin/products');

    expect(() => checkAuth(req, '/admin/products')).not.toThrow();
  });
```

In `apps/api-gateway/src/gateway/gateway.routes.spec.ts`, add this test after the existing `'classifies every documented route group correctly'` test:

```ts
  it('tags the four permission-gated admin screens, and leaves other admin routes untagged', () => {
    expect(matchRoute('/admin/products')?.screen).toBe('products');
    expect(matchRoute('/admin/categories')?.screen).toBe('categories');
    expect(matchRoute('/admin/inventory')?.screen).toBe('inventory');
    expect(matchRoute('/admin/orders')?.screen).toBe('orders');
    expect(matchRoute('/upload')?.screen).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api-gateway && npx jest gateway-auth.spec.ts gateway.routes.spec.ts -t "screen|permission-gated"`
Expected: FAIL — `RouteRule` has no `screen` field yet, and `checkAuth` doesn't check one.

- [ ] **Step 3: Implement**

Replace `apps/api-gateway/src/gateway/gateway.routes.ts`'s contents with:

```ts
export type AuthLevel = 'public' | 'authenticated' | 'admin';

export interface RouteRule {
  /** Matched against the path with the leading /api stripped, e.g. "/orders". */
  prefix: string;
  target: string;
  auth: AuthLevel;
  /**
   * Which admin-web nav screen this route belongs to, for per-screen ADMIN
   * permission checks (E11). SUPER_ADMIN bypasses this regardless. Omit
   * for admin-tier routes with no corresponding toggleable screen (e.g.
   * /upload) — those stay reachable by any ADMIN, same as today.
   */
  screen?: string;
}

const PRODUCTS_URL = process.env.PRODUCTS_URL ?? 'http://localhost:3002';
const INVENTORY_URL = process.env.INVENTORY_URL ?? 'http://localhost:3003';
const CART_URL = process.env.CART_URL ?? 'http://localhost:3004';
const PRODUCT_IMAGE_URL = process.env.PRODUCT_IMAGE_URL ?? 'http://localhost:3005';
const USERS_URL = process.env.USERS_URL ?? 'http://localhost:3006';
const ORDERS_URL = process.env.ORDERS_URL ?? 'http://localhost:3007';

/**
 * Prefix-level routing and auth policy. None of these prefixes are a
 * prefix of one another (e.g. "/admin/orders" vs "/orders" are simply
 * different strings), so match order doesn't matter — the first (only)
 * one that matches wins.
 */
export const ROUTES: RouteRule[] = [
  { prefix: '/admin/products', target: PRODUCTS_URL, auth: 'admin', screen: 'products' },
  { prefix: '/admin/categories', target: PRODUCTS_URL, auth: 'admin', screen: 'categories' },
  { prefix: '/admin/inventory', target: INVENTORY_URL, auth: 'admin', screen: 'inventory' },
  { prefix: '/admin/orders', target: ORDERS_URL, auth: 'admin', screen: 'orders' },
  { prefix: '/admin/users', target: USERS_URL, auth: 'admin' },
  { prefix: '/auth', target: USERS_URL, auth: 'public' },
  { prefix: '/me', target: USERS_URL, auth: 'authenticated' },
  { prefix: '/products', target: PRODUCTS_URL, auth: 'public' },
  { prefix: '/categories', target: PRODUCTS_URL, auth: 'public' },
  { prefix: '/inventory', target: INVENTORY_URL, auth: 'public' },
  { prefix: '/cart', target: CART_URL, auth: 'authenticated' },
  { prefix: '/orders', target: ORDERS_URL, auth: 'authenticated' },
  { prefix: '/upload', target: PRODUCT_IMAGE_URL, auth: 'admin' },
  { prefix: '/media', target: PRODUCT_IMAGE_URL, auth: 'public' },
];

export function matchRoute(path: string): RouteRule | undefined {
  return ROUTES.find((r) => path === r.prefix || path.startsWith(r.prefix + '/'));
}
```

(This also adds the `/admin/users` route from Task 4 — needed now so Task 2's gateway tests and Task 1's rebuild both see a fully-routed gateway; Task 4 wires the actual controller behind it.)

Replace the role/screen check block in `apps/api-gateway/src/gateway/gateway-auth.ts` — currently:

```ts
  if (route.auth === 'admin' && payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    throw new GatewayHttpError(403, 'Forbidden', 'Insufficient role for this action');
  }

  return { route };
```

with:

```ts
  if (route.auth === 'admin') {
    if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
      throw new GatewayHttpError(403, 'Forbidden', 'Insufficient role for this action');
    }
    if (route.screen && payload.role === 'ADMIN') {
      const permissions = Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
      if (!permissions.includes(route.screen)) {
        throw new GatewayHttpError(403, 'Forbidden', `Missing permission for the "${route.screen}" screen`);
      }
    }
  }

  return { route };
```

In `apps/users/src/users/auth.service.ts`, replace `signToken`:

```ts
  signToken(user: { id: number; role: Role; email: string; permissions?: string[] | null }): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(AUTH_NOT_CONFIGURED);
    }
    return jwt.sign(
      { sub: user.id, role: user.role, email: user.email, permissions: user.permissions ?? null },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? DEFAULT_JWT_EXPIRES_IN) as jwt.SignOptions['expiresIn'] },
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api-gateway && npx jest gateway-auth.spec.ts gateway.routes.spec.ts`
Expected: PASS — every test in both files.

Run: `cd apps/api-gateway && npx tsc --noEmit`
Expected: no errors.

Run: `cd apps/users && npx tsc --noEmit`
Expected: fails right now — `UsersService.login` still calls `this.authService.signToken(user)` where `user` (the `User` entity) has no `permissions` field yet. That's expected; Task 3 adds it. Confirm the *only* error is that one.

- [ ] **Step 5: Commit**

```bash
git add apps/api-gateway/src/gateway/gateway.routes.ts apps/api-gateway/src/gateway/gateway.routes.spec.ts apps/api-gateway/src/gateway/gateway-auth.ts apps/api-gateway/src/gateway/gateway-auth.spec.ts apps/users/src/users/auth.service.ts
git commit -m "gateway: enforce per-screen ADMIN permissions from a JWT claim"
```

---

## Task 3: `permissions` column, `SUPER_ADMIN` seed, and the profile DTO

**Files:**
- Create: `apps/users/src/migrations/1758610200000-AddSuperAdminAndPermissions.ts`
- Modify: `apps/users/src/users/entities/user.entity.ts`
- Modify: `apps/users/src/users/admin-seeder.service.ts`
- Modify: `apps/users/src/users/dto/user-profile.dto.ts`
- Modify: `apps/users/src/users/users.service.ts`
- Modify: `apps/users/src/users/users.service.spec.ts`
- Modify: `scripts/e2e-happy-path.js`

**Interfaces:**
- Consumes: `Role.SUPER_ADMIN` (Task 1), the widened `AuthService.signToken` (Task 2).
- Produces: `User.permissions: string[] | null`; `UserProfileDto.permissions: string[] | null` — consumed by Task 4 (`AdminUsersService`) and by admin-web (Task 6).

- [ ] **Step 1: Write the failing test**

In `apps/users/src/users/users.service.spec.ts`, add this test inside the existing `describe('login', ...)` block, after the `'returns a signed token and the sanitized profile on success'` test:

```ts
    it('passes the user\'s permissions through to signToken and the returned profile', async () => {
      const user = {
        id: 1,
        email: 'a@b.com',
        passwordHash: 'hashed',
        name: 'A',
        phone: null,
        role: Role.ADMIN,
        permissions: ['orders'],
        createdAt: new Date(),
      };
      repo.findOneBy!.mockResolvedValue(user);
      authService.comparePassword.mockResolvedValue(true);

      const result = await service.login({ email: 'a@b.com', password: 'right' });

      expect(authService.signToken).toHaveBeenCalledWith(expect.objectContaining({ permissions: ['orders'] }));
      expect(result.user.permissions).toEqual(['orders']);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/users && npx jest users.service.spec.ts -t "permissions through"`
Expected: FAIL — `UsersService.toProfile` doesn't include `permissions` yet, so `result.user.permissions` is `undefined`.

- [ ] **Step 3: Implement**

Create the migration:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds per-admin screen permissions (jsonb array, meaningful only for
 * ADMIN accounts — null for SUPER_ADMIN and CUSTOMER). No change needed
 * to the `role` column's varchar(16) width: 'SUPER_ADMIN' is 11 characters.
 */
export class AddSuperAdminAndPermissions1758610200000 implements MigrationInterface {
  name = 'AddSuperAdminAndPermissions1758610200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users"."users" ADD COLUMN "permissions" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "permissions"`);
  }
}
```

Replace `apps/users/src/users/entities/user.entity.ts`'s contents with:

```ts
import { Role } from '@salescart/common';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'users', schema: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 16, default: Role.CUSTOMER })
  role!: Role;

  /** Screen names this ADMIN account can reach (e.g. ["products","orders"]). Always null for SUPER_ADMIN (implicit full access) and CUSTOMER. */
  @Column({ type: 'jsonb', nullable: true })
  permissions!: string[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
```

In `apps/users/src/users/admin-seeder.service.ts`, replace `role: Role.ADMIN,` with `role: Role.SUPER_ADMIN,` (there must be one root account able to grant everyone else's permissions from first boot).

In `apps/users/src/users/dto/user-profile.dto.ts`, replace the file's contents with:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@salescart/common';

/** What a user (or the admin looking at their own profile) ever sees of themselves — never the password hash. */
export class UserProfileDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'asha@example.com' })
  email!: string;

  @ApiProperty({ example: 'Asha Rao' })
  name!: string;

  @ApiProperty({ example: '+91 90000 00000', nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role!: Role;

  @ApiPropertyOptional({ type: [String], nullable: true, example: ['products', 'orders'], description: 'Screens this ADMIN can reach. Always null for SUPER_ADMIN and CUSTOMER.' })
  permissions!: string[] | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}
```

In `apps/users/src/users/users.service.ts`, replace `toProfile`:

```ts
  private toProfile(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
      createdAt: user.createdAt,
    };
  }
```

In `scripts/e2e-happy-path.js`, the seeded bootstrap account is now `SUPER_ADMIN`, not `ADMIN` — replace:

```js
  const { accessToken: adminToken, user: admin } = await call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert(admin.role === 'ADMIN', 'admin login returns an ADMIN role');
```

with:

```js
  const { accessToken: adminToken, user: admin } = await call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert(admin.role === 'SUPER_ADMIN', 'the seeded bootstrap admin logs in as SUPER_ADMIN');
```

- [ ] **Step 4: Run migration**

Postgres must be reachable (`npm run start:infra` from the repo root if it isn't already up).

Run: `cd apps/users && npm run migration:run`
Expected: output lists `AddSuperAdminAndPermissions1758610200000` as executed, no errors.

If a `SUPER_ADMIN`-seeded account from a *previous* run of this stack already exists as plain `ADMIN` in this dev database (the seeder only runs its insert once, on first boot, and won't retroactively promote an existing row), manually promote it so the rest of this plan's manual testing has a working super admin:

Run: `cd apps/users && npx typeorm-ts-node-commonjs query "UPDATE \"users\".\"users\" SET role = 'SUPER_ADMIN' WHERE email = '${ADMIN_EMAIL}'" -d src/data-source.ts` (substitute the real `ADMIN_EMAIL` value from `apps/users/.env`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/users && npx jest`
Expected: PASS — every test, including the new one.

Run: `cd apps/users && npx tsc --noEmit`
Expected: no errors (the Task 2 `signToken` mismatch is now resolved).

- [ ] **Step 6: Commit**

```bash
git add apps/users/src/migrations/1758610200000-AddSuperAdminAndPermissions.ts apps/users/src/users/entities/user.entity.ts apps/users/src/users/admin-seeder.service.ts apps/users/src/users/dto/user-profile.dto.ts apps/users/src/users/users.service.ts apps/users/src/users/users.service.spec.ts scripts/e2e-happy-path.js
git commit -m "users: add permissions column, seed the bootstrap account as SUPER_ADMIN"
```

---

## Task 4: `AdminUsersController` — create/list/permissions/delete

**Files:**
- Create: `apps/users/src/users/dto/create-admin.dto.ts`
- Create: `apps/users/src/users/dto/update-admin-permissions.dto.ts`
- Create: `apps/users/src/users/admin-users.service.ts`
- Create: `apps/users/src/users/admin-users.service.spec.ts`
- Create: `apps/users/src/users/admin-users.controller.ts`
- Create: `apps/users/src/users/admin-users.controller.spec.ts`
- Modify: `apps/users/src/constants/users.constants.ts`
- Modify: `apps/users/src/users/users.module.ts`

**Interfaces:**
- Consumes: `User.permissions` (Task 3), `Role.SUPER_ADMIN` (Task 1).
- Produces: `AdminUsersService.list(): Promise<UserProfileDto[]>`, `.create(dto: CreateAdminDto): Promise<UserProfileDto>`, `.updatePermissions(id: number, dto: UpdateAdminPermissionsDto): Promise<UserProfileDto>`, `.remove(id: number, requesterId: number): Promise<void>` — consumed by `AdminUsersController` (this task) and Task 5's e2e script.

- [ ] **Step 1: Write the failing tests**

Update `apps/users/src/constants/users.constants.ts` — replace its contents with:

```ts
export const EMAIL_ALREADY_REGISTERED = 'An account with this email already exists';
export const INVALID_CREDENTIALS = 'Invalid email or password';
export const USER_NOT_FOUND = 'User not found';
export const ADDRESS_NOT_FOUND = 'Address not found';
export const AUTH_NOT_CONFIGURED = 'Auth is not configured';
export const CANNOT_DELETE_SELF = 'You cannot remove your own account';
export const CANNOT_TARGET_SUPER_ADMIN = 'Super admin accounts cannot be modified through this endpoint';
export const TARGET_NOT_ADMIN = 'That account is not an admin account';

export const BCRYPT_SALT_ROUNDS = 10;
export const DEFAULT_JWT_EXPIRES_IN = '1h';

/** Whole-screen permissions a super admin can grant an ADMIN account — matches admin-web's nav items exactly. */
export const ADMIN_SCREENS = ['products', 'categories', 'inventory', 'orders'] as const;
export type AdminScreen = (typeof ADMIN_SCREENS)[number];
```

Create `apps/users/src/users/admin-users.service.spec.ts`:

```ts
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@salescart/common';
import { AdminUsersService } from './admin-users.service';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

type MockRepo = Partial<Record<keyof Repository<User>, jest.Mock>>;

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let repo: MockRepo;
  let authService: { hashPassword: jest.Mock };

  beforeEach(async () => {
    repo = { findOneBy: jest.fn(), find: jest.fn(), save: jest.fn(), remove: jest.fn() };
    authService = { hashPassword: jest.fn().mockResolvedValue('hashed') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  describe('create', () => {
    it('rejects a duplicate email with 409', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, email: 'a@b.com' });
      await expect(
        service.create({ email: 'a@b.com', password: 'password1', name: 'A', permissions: ['orders'] }),
      ).rejects.toThrow(ConflictException);
    });

    it('always creates role ADMIN, never SUPER_ADMIN, with the given permissions', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      repo.save!.mockResolvedValue({
        id: 2, email: 'new@b.com', passwordHash: 'hashed', name: 'New', phone: null,
        role: Role.ADMIN, permissions: ['orders'], createdAt: new Date(),
      });

      const result = await service.create({ email: 'new@b.com', password: 'password1', name: 'New', permissions: ['orders'] });

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ role: Role.ADMIN, permissions: ['orders'] }));
      expect(result.role).toBe(Role.ADMIN);
    });
  });

  describe('updatePermissions', () => {
    it('throws NotFoundException for an unknown user', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      await expect(service.updatePermissions(999, { permissions: ['orders'] })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the target is a SUPER_ADMIN, not an ADMIN', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 1, role: Role.SUPER_ADMIN, permissions: null });
      await expect(service.updatePermissions(1, { permissions: ['orders'] })).rejects.toThrow(NotFoundException);
    });

    it('updates an ADMIN\'s permissions', async () => {
      const user = { id: 1, role: Role.ADMIN, permissions: ['products'] };
      repo.findOneBy!.mockResolvedValue(user);

      const result = await service.updatePermissions(1, { permissions: ['orders', 'inventory'] });

      expect(user.permissions).toEqual(['orders', 'inventory']);
      expect(result.permissions).toEqual(['orders', 'inventory']);
    });
  });

  describe('remove', () => {
    it('rejects removing your own account before any lookup', async () => {
      await expect(service.remove(1, 1)).rejects.toThrow(ForbiddenException);
      expect(repo.findOneBy).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown user', async () => {
      repo.findOneBy!.mockResolvedValue(null);
      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('rejects targeting a SUPER_ADMIN account', async () => {
      repo.findOneBy!.mockResolvedValue({ id: 2, role: Role.SUPER_ADMIN });
      await expect(service.remove(2, 1)).rejects.toThrow(ForbiddenException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('removes an ADMIN account', async () => {
      const user = { id: 2, role: Role.ADMIN };
      repo.findOneBy!.mockResolvedValue(user);

      await service.remove(2, 1);

      expect(repo.remove).toHaveBeenCalledWith(user);
    });
  });
});
```

Create `apps/users/src/users/admin-users.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let service: { list: jest.Mock; create: jest.Mock; updatePermissions: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    service = { list: jest.fn(), create: jest.fn(), updatePermissions: jest.fn(), remove: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: service }],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('remove forwards the target id and the requesting admin\'s id', async () => {
    await controller.remove(5, { id: 99 } as any);
    expect(service.remove).toHaveBeenCalledWith(5, 99);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/users && npx jest admin-users.service.spec.ts admin-users.controller.spec.ts`
Expected: FAIL — `AdminUsersService` and `AdminUsersController` don't exist yet (module resolution errors).

- [ ] **Step 3: Implement**

Create `apps/users/src/users/dto/create-admin.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ADMIN_SCREENS } from '../../constants/users.constants';
import type { AdminScreen } from '../../constants/users.constants';

export class CreateAdminDto {
  @ApiProperty({ example: 'asha@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'at-least-8-chars', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Asha Rao' })
  @IsString()
  name!: string;

  @ApiProperty({ type: [String], enum: ADMIN_SCREENS, example: ['products', 'orders'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(ADMIN_SCREENS, { each: true })
  permissions!: AdminScreen[];
}
```

Create `apps/users/src/users/dto/update-admin-permissions.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import { ADMIN_SCREENS } from '../../constants/users.constants';
import type { AdminScreen } from '../../constants/users.constants';

export class UpdateAdminPermissionsDto {
  @ApiProperty({ type: [String], enum: ADMIN_SCREENS, example: ['products', 'orders'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(ADMIN_SCREENS, { each: true })
  permissions!: AdminScreen[];
}
```

Create `apps/users/src/users/admin-users.service.ts`:

```ts
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '@salescart/common';
import { User } from './entities/user.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminPermissionsDto } from './dto/update-admin-permissions.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { AuthService } from './auth.service';
import {
  CANNOT_DELETE_SELF,
  CANNOT_TARGET_SUPER_ADMIN,
  EMAIL_ALREADY_REGISTERED,
  TARGET_NOT_ADMIN,
  USER_NOT_FOUND,
} from '../constants/users.constants';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  private toProfile(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
      createdAt: user.createdAt,
    };
  }

  async list(): Promise<UserProfileDto[]> {
    const admins = await this.userRepository.find({
      where: { role: In([Role.ADMIN, Role.SUPER_ADMIN]) },
      order: { createdAt: 'ASC' },
    });
    return admins.map((u) => this.toProfile(u));
  }

  async create(dto: CreateAdminDto): Promise<UserProfileDto> {
    const existing = await this.userRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED);
    }

    const passwordHash = await this.authService.hashPassword(dto.password);
    const user = await this.userRepository.save({
      email: dto.email,
      passwordHash,
      name: dto.name,
      phone: null,
      role: Role.ADMIN, // never SUPER_ADMIN — promotion is a manual/DB action only
      permissions: dto.permissions,
    });

    return this.toProfile(user);
  }

  async updatePermissions(id: number, dto: UpdateAdminPermissionsDto): Promise<UserProfileDto> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND);
    }
    if (user.role !== Role.ADMIN) {
      throw new NotFoundException(TARGET_NOT_ADMIN);
    }

    user.permissions = dto.permissions;
    await this.userRepository.save(user);
    return this.toProfile(user);
  }

  async remove(id: number, requesterId: number): Promise<void> {
    if (id === requesterId) {
      throw new ForbiddenException(CANNOT_DELETE_SELF);
    }

    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND);
    }
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException(CANNOT_TARGET_SUPER_ADMIN);
    }

    await this.userRepository.remove(user);
  }
}
```

Create `apps/users/src/users/admin-users.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Role, Roles } from '@salescart/common';
import type { AuthenticatedUser } from '@salescart/common';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminPermissionsDto } from './dto/update-admin-permissions.dto';
import { UserProfileDto } from './dto/user-profile.dto';

@ApiTags('admin/users')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOkResponse({ type: [UserProfileDto] })
  findAll(): Promise<UserProfileDto[]> {
    return this.adminUsersService.list();
  }

  @Post()
  @ApiOkResponse({ type: UserProfileDto })
  create(@Body() dto: CreateAdminDto): Promise<UserProfileDto> {
    return this.adminUsersService.create(dto);
  }

  @Patch(':id/permissions')
  @ApiOkResponse({ type: UserProfileDto })
  updatePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminPermissionsDto,
  ): Promise<UserProfileDto> {
    return this.adminUsersService.updatePermissions(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    return this.adminUsersService.remove(id, admin.id);
  }
}
```

Replace `apps/users/src/users/users.module.ts`'s contents with:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalKeyGuard, JwtAuthGuard, RolesGuard } from '@salescart/common';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { AdminUsersController } from './admin-users.controller';
import { UsersService } from './users.service';
import { AddressesService } from './addresses.service';
import { AuthService } from './auth.service';
import { AdminUsersService } from './admin-users.service';
import { AdminSeederService } from './admin-seeder.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Address])],
  controllers: [AuthController, MeController, AdminUsersController],
  providers: [
    UsersService,
    AddressesService,
    AuthService,
    AdminUsersService,
    AdminSeederService,
    // Every route needs the internal key (E6-1) — even @Public() ones
    // like register/login, since "public" here means "no JWT required",
    // not "reachable directly, bypassing the gateway". JWT is required
    // unless marked @Public(); RolesGuard is a no-op until a route adds
    // @Roles(...).
    { provide: APP_GUARD, useClass: InternalKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class UsersModule {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/users && npx jest`
Expected: PASS — every test in the service, including all of `admin-users.service.spec.ts` and `admin-users.controller.spec.ts`.

Run: `cd apps/users && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/users/src/constants/users.constants.ts apps/users/src/users/dto/create-admin.dto.ts apps/users/src/users/dto/update-admin-permissions.dto.ts apps/users/src/users/admin-users.service.ts apps/users/src/users/admin-users.service.spec.ts apps/users/src/users/admin-users.controller.ts apps/users/src/users/admin-users.controller.spec.ts apps/users/src/users/users.module.ts
git commit -m "users: add SUPER_ADMIN-only admin account management (create/list/permissions/delete)"
```

---

## Task 5: e2e coverage for screen permissions

**Files:**
- Modify: `scripts/e2e-happy-path.js`

**Interfaces:**
- Consumes: `POST /admin/users`, `PATCH /admin/users/:id/permissions`, `DELETE /admin/users/:id` (Task 4, over HTTP through the gateway); the gateway's screen-permission 403 (Task 2).

- [ ] **Step 1: Add the scenario**

Insert this block right before the final `console.log('\nPASS — ...')` line (after the order-fulfillment scenario this file already ends with), keeping that `console.log` as the last thing `main()` does:

```js
  step('Third scenario: a super admin creates a screen-restricted admin');
  try {
    await call(
      'POST',
      '/admin/users',
      { email: `e2e-invalid-${Date.now()}@example.com`, password: 'password123', name: 'E2E Invalid', permissions: ['not-a-real-screen'] },
      adminToken,
    );
    throw new Error('expected a 400 for an unknown permission value');
  } catch (err) {
    assert(String(err.message).includes('400'), 'an unrecognized screen name in permissions is rejected');
  }

  const restrictedAdmin = await call(
    'POST',
    '/admin/users',
    { email: `e2e-restricted-${Date.now()}@example.com`, password: 'password123', name: 'E2E Restricted Admin', permissions: ['orders'] },
    adminToken,
  );
  assert(restrictedAdmin.role === 'ADMIN', 'the new account is a plain ADMIN, never SUPER_ADMIN');
  assert(JSON.stringify(restrictedAdmin.permissions) === JSON.stringify(['orders']), 'permissions were saved as given');

  const { accessToken: restrictedToken } = await call('POST', '/auth/login', { email: restrictedAdmin.email, password: 'password123' });

  await call('GET', '/admin/orders', undefined, restrictedToken);

  try {
    await call('GET', '/admin/products', undefined, restrictedToken);
    throw new Error('expected a 403 for a screen the restricted admin was not granted');
  } catch (err) {
    assert(String(err.message).includes('403'), 'the restricted admin is rejected on a screen they were not granted');
  }

  const updated = await call('PATCH', `/admin/users/${restrictedAdmin.id}/permissions`, { permissions: ['orders', 'products'] }, adminToken);
  assert(JSON.stringify(updated.permissions.sort()) === JSON.stringify(['orders', 'products']), 'permissions were updated');

  await call('DELETE', `/admin/users/${restrictedAdmin.id}`, undefined, adminToken);

  const remaining = await call('GET', '/admin/users', undefined, adminToken);
  assert(!remaining.some((a) => a.id === restrictedAdmin.id), 'the removed admin no longer appears in the admin list');
```

- [ ] **Step 2: Run it against the live stack**

Requires the full stack up (`npm run start:infra` + `npm run start:all` from the repo root) and the `DELETE`/`call` helper already handling a body-less request correctly — this script's existing `call()` helper already supports `undefined` bodies for `GET`/`DELETE`/`PATCH` (see the existing `deliver`/`confirm` calls), so no change needed there.

Run: `node scripts/e2e-happy-path.js`
Expected: `PASS` at the end, with every `ok —` line printed for all three scenarios and no `FAIL`.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-happy-path.js
git commit -m "e2e: cover screen-restricted admin creation, enforcement, permission updates, and removal"
```

---

## Task 6: admin-web — types, API client, and the login role check

**Files:**
- Modify: `apps/admin-web/src/api/types.ts`
- Create: `apps/admin-web/src/api/adminUsers.ts`
- Modify: `apps/admin-web/src/context/AuthContext.tsx`

**Interfaces:**
- Produces: `Role` widened to include `'SUPER_ADMIN'`; `AdminScreen` type; `UserProfile.permissions: AdminScreen[] | null`; `adminUsersApi.getAdmins/createAdmin/updateAdminPermissions/removeAdmin` — consumed by Task 7.

**Important pre-existing bug this task must fix:** `AuthContext.tsx`'s `login` currently does `if (profile.role !== 'ADMIN') throw new Error('This dashboard is for admin accounts only.')` — this would lock a `SUPER_ADMIN` out of admin-web entirely, since their role is `'SUPER_ADMIN'`, not `'ADMIN'`. Step 3 below fixes this.

- [ ] **Step 1: Update `types.ts`**

Replace:

```ts
export type Role = 'CUSTOMER' | 'ADMIN';

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  createdAt: string;
}
```

with:

```ts
export type Role = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
export type AdminScreen = 'products' | 'categories' | 'inventory' | 'orders';

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  permissions: AdminScreen[] | null;
  createdAt: string;
}
```

- [ ] **Step 2: Create `adminUsers.ts`**

```ts
import { apiClient } from './client';
import { AdminScreen, UserProfile } from './types';

export const getAdmins = (): Promise<UserProfile[]> =>
  apiClient.get('/admin/users').then((r) => r.data);

export const createAdmin = (input: { email: string; password: string; name: string; permissions: AdminScreen[] }): Promise<UserProfile> =>
  apiClient.post('/admin/users', input).then((r) => r.data);

export const updateAdminPermissions = (id: number, permissions: AdminScreen[]): Promise<UserProfile> =>
  apiClient.patch(`/admin/users/${id}/permissions`, { permissions }).then((r) => r.data);

export const removeAdmin = (id: number): Promise<void> =>
  apiClient.delete(`/admin/users/${id}`).then(() => undefined);
```

- [ ] **Step 3: Fix the login role check in `AuthContext.tsx`**

Replace:

```ts
  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user: profile } = await authApi.login(email, password);
    if (profile.role !== 'ADMIN') {
      throw new Error('This dashboard is for admin accounts only.');
    }
    setToken(accessToken);
    setUser(profile);
  }, []);
```

with:

```ts
  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user: profile } = await authApi.login(email, password);
    if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
      throw new Error('This dashboard is for admin accounts only.');
    }
    setToken(accessToken);
    setUser(profile);
  }, []);
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/admin-web && npx tsc --noEmit`
Expected: no errors — nothing existing reads `UserProfile.permissions` yet, so adding it doesn't break anything, and `Role` widening is additive to a union type.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web/src/api/types.ts apps/admin-web/src/api/adminUsers.ts apps/admin-web/src/context/AuthContext.tsx
git commit -m "admin-web: add SUPER_ADMIN role, admin-user-management API client, and let super admins actually log in"
```

---

## Task 7: admin-web — permission-aware nav, routing, and the Admin Users screen

**Files:**
- Create: `apps/admin-web/src/lib/adminScreens.ts`
- Create: `apps/admin-web/src/components/PermissionedRoute.tsx`
- Create: `apps/admin-web/src/pages/AdminUsersPage.tsx`
- Modify: `apps/admin-web/src/components/Layout.tsx`
- Modify: `apps/admin-web/src/App.tsx`

**Interfaces:**
- Consumes: `adminUsersApi.*`, `UserProfile.permissions`, `AdminScreen` (Task 6).

- [ ] **Step 1: Create `adminScreens.ts`**

```ts
import { AdminScreen } from '../api/types';

/** Same order as the nav — used to pick a sane default landing screen for a restricted admin. */
export const ADMIN_SCREEN_ORDER: AdminScreen[] = ['products', 'categories', 'inventory', 'orders'];

export function firstAccessibleScreen(permissions: AdminScreen[] | null | undefined): AdminScreen | null {
  return ADMIN_SCREEN_ORDER.find((screen) => permissions?.includes(screen)) ?? null;
}
```

- [ ] **Step 2: Create `PermissionedRoute.tsx`**

```tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminScreen } from '../api/types';

interface Props {
  children: React.ReactElement;
  screen?: AdminScreen;
  requireSuperAdmin?: boolean;
}

/** Gates a route by the current admin's screen permissions (or SUPER_ADMIN-only), redirecting to "/" — which itself lands on a screen this admin can actually reach — rather than rendering a page the gateway would 403 anyway. */
export default function PermissionedRoute({ children, screen, requireSuperAdmin }: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  if (screen && !isSuperAdmin && !user?.permissions?.includes(screen)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
```

- [ ] **Step 3: Update `Layout.tsx`**

Replace the file's contents with:

```tsx
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminScreen } from '../api/types';

const NAV_ITEMS: Array<{ to: string; label: string; screen: AdminScreen }> = [
  { to: '/products', label: 'Products', screen: 'products' },
  { to: '/categories', label: 'Categories', screen: 'categories' },
  { to: '/inventory', label: 'Inventory', screen: 'inventory' },
  { to: '/orders', label: 'Orders', screen: 'orders' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const visibleItems = isSuperAdmin ? NAV_ITEMS : NAV_ITEMS.filter((item) => user?.permissions?.includes(item.screen));

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>SalesCart Admin</div>
        <nav style={styles.nav}>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
            >
              {item.label}
            </NavLink>
          ))}
          {isSuperAdmin && (
            <NavLink
              to="/admin-users"
              style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
            >
              Admin Users
            </NavLink>
          )}
        </nav>
        <div style={styles.userBox}>
          <div style={styles.userName}>{user?.name}</div>
          <div style={styles.userEmail}>{user?.email}</div>
          <button className="btn-ghost" style={styles.logoutButton} onClick={logout}>Log out</button>
        </div>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: 'var(--surface)',
    borderRight: '1px solid var(--line)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 16px',
  },
  brand: { fontWeight: 800, fontSize: 16, marginBottom: 24, letterSpacing: '-0.01em' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  navLink: {
    padding: '9px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--muted)',
    textDecoration: 'none',
  },
  navLinkActive: { background: 'var(--admin-tint)', color: 'var(--admin)' },
  userBox: { borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 },
  userName: { fontSize: 13, fontWeight: 700 },
  userEmail: { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  logoutButton: { marginTop: 8, fontSize: 12, padding: 0 },
  main: { flex: 1, padding: '28px 32px', maxWidth: 1100, width: '100%' },
};
```

- [ ] **Step 4: Create `AdminUsersPage.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import * as adminUsersApi from '../api/adminUsers';
import { AdminScreen, UserProfile } from '../api/types';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const SCREEN_OPTIONS: Array<{ value: AdminScreen; label: string }> = [
  { value: 'products', label: 'Products' },
  { value: 'categories', label: 'Categories' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'orders', label: 'Orders' },
];

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<Set<AdminScreen>>(new Set(SCREEN_OPTIONS.map((s) => s.value)));

  const load = () => {
    setLoading(true);
    adminUsersApi
      .getAdmins()
      .then(setAdmins)
      .catch((err) => setError(extractErrorMessage(err, 'Could not load admin accounts')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleNewPermission = (screen: AdminScreen) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(screen)) next.delete(screen); else next.add(screen);
      return next;
    });
  };

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminUsersApi.createAdmin({ email, password, name, permissions: Array.from(permissions) });
      setName('');
      setEmail('');
      setPassword('');
      setPermissions(new Set(SCREEN_OPTIONS.map((s) => s.value)));
      load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not create this admin account'));
    } finally {
      setBusy(false);
    }
  };

  const onToggleExistingPermission = async (admin: UserProfile, screen: AdminScreen) => {
    const current = new Set(admin.permissions ?? []);
    if (current.has(screen)) current.delete(screen); else current.add(screen);
    setBusy(true);
    setError(null);
    try {
      await adminUsersApi.updateAdminPermissions(admin.id, Array.from(current));
      load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not update permissions'));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (admin: UserProfile) => {
    setBusy(true);
    setError(null);
    try {
      await adminUsersApi.removeAdmin(admin.id);
      load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not remove this admin'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 style={styles.title}>Admin users</h1>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="card" style={styles.card}>
        <h2 style={styles.sectionHeading}>Existing admins</h2>
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Screens</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.name}</td>
                  <td>{admin.email}</td>
                  <td>{admin.role}</td>
                  <td>
                    {admin.role === 'SUPER_ADMIN' ? (
                      <span style={{ color: 'var(--muted)' }}>All (super admin)</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {SCREEN_OPTIONS.map((s) => (
                          <label key={s.value} style={styles.chipLabel}>
                            <input
                              type="checkbox"
                              checked={(admin.permissions ?? []).includes(s.value)}
                              disabled={busy}
                              onChange={() => onToggleExistingPermission(admin, s.value)}
                            />
                            {s.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {admin.role === 'ADMIN' && admin.id !== currentUser?.id && (
                      <button className="btn-danger" disabled={busy} onClick={() => onRemove(admin)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={styles.card}>
        <h2 style={styles.sectionHeading}>New admin</h2>
        <label style={styles.label}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label style={styles.label}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <label style={styles.label}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label style={styles.label}>Screens</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {SCREEN_OPTIONS.map((s) => (
            <label key={s.value} style={styles.chipLabel}>
              <input type="checkbox" checked={permissions.has(s.value)} onChange={() => toggleNewPermission(s.value)} />
              {s.label}
            </label>
          ))}
        </div>
        <button
          className="btn-primary"
          disabled={busy || !name || !email || password.length < 8}
          onClick={onCreate}
        >
          Create admin
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: 22, fontWeight: 800, marginBottom: 16 },
  card: { padding: 20, marginBottom: 20 },
  sectionHeading: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', margin: '0 0 12px' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 10, marginBottom: 4 },
  chipLabel: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 },
};
```

- [ ] **Step 5: Update `App.tsx`**

Replace the file's contents with:

```tsx
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PermissionedRoute from './components/PermissionedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import CategoriesPage from './pages/CategoriesPage';
import InventoryPage from './pages/InventoryPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import AdminUsersPage from './pages/AdminUsersPage';
import { firstAccessibleScreen } from './lib/adminScreens';

function DefaultRedirect() {
  const { user } = useAuth();
  if (user?.role === 'SUPER_ADMIN') {
    return <Navigate to="/products" replace />;
  }
  const screen = firstAccessibleScreen(user?.permissions);
  if (screen) {
    return <Navigate to={`/${screen}`} replace />;
  }
  return <p style={{ padding: 40, color: 'var(--muted)' }}>You don't have access to any screen yet. Ask your super admin to grant one.</p>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DefaultRedirect />} />
            <Route path="/products" element={<PermissionedRoute screen="products"><ProductsPage /></PermissionedRoute>} />
            <Route path="/products/new" element={<PermissionedRoute screen="products"><ProductFormPage /></PermissionedRoute>} />
            <Route path="/products/:id" element={<PermissionedRoute screen="products"><ProductFormPage /></PermissionedRoute>} />
            <Route path="/categories" element={<PermissionedRoute screen="categories"><CategoriesPage /></PermissionedRoute>} />
            <Route path="/inventory" element={<PermissionedRoute screen="inventory"><InventoryPage /></PermissionedRoute>} />
            <Route path="/orders" element={<PermissionedRoute screen="orders"><OrdersPage /></PermissionedRoute>} />
            <Route path="/orders/:id" element={<PermissionedRoute screen="orders"><OrderDetailPage /></PermissionedRoute>} />
            <Route path="/admin-users" element={<PermissionedRoute requireSuperAdmin><AdminUsersPage /></PermissionedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

(The catch-all route now goes to `/` — which resolves permission-aware via `DefaultRedirect` — instead of hardcoding `/products`, which a screen-restricted admin might not have.)

- [ ] **Step 6: Typecheck**

Run: `cd apps/admin-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual check**

With the full stack running (`npm run start:infra`, `npm run start:all` from the repo root, `npm run dev` in `apps/admin-web`):
1. Log in as the seeded super admin — confirm every nav item plus "Admin Users" is visible.
2. On the Admin Users page, create a new admin with only "Orders" checked.
3. Log out, log in as that new admin — confirm only "Orders" appears in the nav, and navigating directly to `/products` bounces back to `/orders`.
4. Log back in as the super admin, toggle "Products" on for that admin from the table, remove the "Orders" checkbox from another existing test admin if one exists, and confirm a "Remove" button removes an admin (and that the super admin's own row has no "Remove" button).

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web/src/lib/adminScreens.ts apps/admin-web/src/components/PermissionedRoute.tsx apps/admin-web/src/pages/AdminUsersPage.tsx apps/admin-web/src/components/Layout.tsx apps/admin-web/src/App.tsx
git commit -m "admin-web: permission-aware nav/routing and the Admin Users screen"
```
