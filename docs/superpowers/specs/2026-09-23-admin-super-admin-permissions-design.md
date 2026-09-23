# Super admin & per-screen permissions — design spec

**Epic:** E11 (next after E10 · Order fulfillment overhaul)
**Status:** Approved for planning
**Depends on:** nothing outside `libs/common`, `apps/api-gateway`, `apps/users`,
`apps/admin-web`, and the 5 downstream admin controllers listed below.
Independent of the order-fulfillment spec — no shared data or screens.

## Why

Today there's one flat `ADMIN` role: anyone with it can reach every
admin-web screen and every `/admin/*` endpoint. There's no way to create a
second admin account with restricted access, and no way to remove one — the
only admin account in the system is a single seeded bootstrap user
(`AdminSeederService`).

This spec adds a `SUPER_ADMIN` role that can create and remove `ADMIN`
accounts and grant each one whole-screen access (Products, Categories,
Inventory, Orders) — no view/edit split within a screen, that's explicitly
out of scope for now.

## Current state (for context)

- `Role` enum (`libs/common/src/enums/role.enum.ts`) has exactly `CUSTOMER`
  and `ADMIN`.
- Two **separate** places currently gate `ADMIN`-only access, both by exact
  role equality — both need widening for `SUPER_ADMIN` to work at all:
  1. The gateway's own check, before a request is ever proxied downstream
     (`apps/api-gateway/src/gateway/gateway-auth.ts`):
     `if (route.auth === 'admin' && payload.role !== 'ADMIN') throw 403`.
  2. Each downstream service's `RolesGuard`
     (`libs/common/src/guards/roles.guard.ts`), driven by `@Roles(Role.ADMIN)`
     on 5 controllers: `admin-inventory.controller.ts`,
     `admin-orders.controller.ts`, `media.controller.ts` (product-image),
     `admin-categories.controller.ts`, `admin-products.controller.ts`.
     `RolesGuard` checks `required.includes(user.role)` — an exact list
     membership check, not a hierarchy.
- JWTs are signed by `AuthService.signToken`
  (`apps/users/src/users/auth.service.ts`) with `{ sub, role, email }`, 1
  hour expiry, no revocation mechanism anywhere in the app.
- `apps/admin-web/src/components/Layout.tsx` has one hardcoded
  `NAV_ITEMS` list (Products, Categories, Inventory, Orders) shown to every
  logged-in admin unconditionally.
- Admin accounts can currently only be created by the one-time seeder;
  public registration (`AuthController.register`) always creates `CUSTOMER`
  (`apps/users/src/users/users.service.ts`, `role: Role.CUSTOMER` is
  hardcoded — "public registration can never create an admin").

## Role & enforcement model

- `Role` gains `SUPER_ADMIN`.
- `AdminSeederService` seeds the bootstrap account as `SUPER_ADMIN` instead
  of `ADMIN` — there must be one root account able to grant everyone else's
  permissions from first boot.
- **Gateway** (`gateway-auth.ts`): the `admin`-tier check widens to accept
  `ADMIN` or `SUPER_ADMIN`.
- **Downstream services**: all 5 `@Roles(Role.ADMIN)` decorators become
  `@Roles(Role.ADMIN, Role.SUPER_ADMIN)`.
- **Screen permissions** are enforced at the gateway — the one place that
  already decodes the JWT for every `/admin/*` call, keeping the "gateway is
  the single door" property the rest of this app already relies on (see
  `docs/salescart-blueprint.html`, Architecture section). No changes needed
  in the 5 downstream services for this part:
  - The JWT payload gains a `permissions: string[]` claim (only meaningful
    for `ADMIN`; omitted/ignored for `SUPER_ADMIN`, which always passes).
  - Each `RouteRule` in `apps/api-gateway/src/gateway/gateway.routes.ts`
    gains an optional `screen` tag:
    `/admin/products` and `/admin/categories` → `"products"` /
    `"categories"` respectively (they're separate nav items, so separate
    screens, even though both live in the `products` service),
    `/admin/inventory` → `"inventory"`, `/admin/orders` → `"orders"`.
  - If the caller's role is `ADMIN` and the matched route has a `screen` not
    present in their `permissions` claim → 403, same shape as today's
    `GatewayHttpError`. `SUPER_ADMIN` bypasses this check entirely.
- **Accepted limitation**: JWTs are stateless with a 1-hour TTL and this app
  has no revocation mechanism for anyone today. A permission change or an
  admin's removal takes effect on their next login / token refresh, not
  immediately. Building revocation is out of scope for this spec — it's a
  pre-existing tradeoff the app already lives with everywhere, not a new one
  introduced here.

## Data model changes

`apps/users` (schema `users`), via a new TypeORM migration:

- `User` gains `permissions: string[] | null` (stored as a `jsonb` column).
  Meaningful only when `role === 'ADMIN'`; `null` for `SUPER_ADMIN` (implicit
  full access) and `CUSTOMER` (irrelevant, always `null`).

Valid values: `"products"`, `"categories"`, `"inventory"`, `"orders"` —
matching admin-web's current nav items exactly.

## API changes (`apps/users`)

New `AdminUsersController`, `@Roles(Role.SUPER_ADMIN)` on the whole
controller (only a super admin may reach any of these):

- `GET /admin/users` — lists every `ADMIN`/`SUPER_ADMIN` account: id, name,
  email, role, permissions, createdAt. Unpaginated — admin headcount is
  expected to stay small; add pagination later if that stops being true.
- `POST /admin/users` — `{ email, password, name, permissions: string[] }`.
  Creates a `role: ADMIN` account (password hashed the same way
  `UsersService.register` already does). **Always creates `ADMIN`, never
  `SUPER_ADMIN`** — promoting an account to super admin is a manual/DB
  action, not exposed through this endpoint or any UI. `permissions` values
  validated against the fixed 4-item list with `@IsIn`.
- `PATCH /admin/users/:id/permissions` — `{ permissions: string[] }`. 404 if
  the target isn't an `ADMIN` (a `SUPER_ADMIN`'s access isn't toggleable —
  it's always full).
- `DELETE /admin/users/:id` — removes an `ADMIN` account. Guardrails (409 or
  403, matching this codebase's existing `ConflictException`/
  `ForbiddenException` conventions):
  - Rejects deleting yourself.
  - Rejects targeting a `SUPER_ADMIN` account (this endpoint only ever
    touches `ADMIN` accounts — removing a super admin is, like promotion, a
    manual/DB action).
  - No cascade concerns: other services reference an admin only by a bare
    `actorId: number` on their own event/audit rows (e.g.
    `apps/orders/src/orders/entities/order-event.entity.ts`), never a
    foreign key back into the `users` schema — deleting the row doesn't
    break historical records, same as today.
- `UserProfileDto` (`apps/users/src/users/dto/user-profile.dto.ts`, returned
  by `/auth/login` and `/me`) gains `permissions: string[] | null`.

## admin-web UI

- `Layout.tsx`'s `NAV_ITEMS` becomes permission-aware:
  - `SUPER_ADMIN`: every existing item, plus a new **Admin Users** item.
  - `ADMIN`: only items whose screen name is in `user.permissions`.
- A `PermissionedRoute` wrapper (alongside the existing `ProtectedRoute`)
  takes a required screen name; navigating directly to a URL for a screen
  the admin lacks redirects away, the same way `ProtectedRoute` already
  redirects unauthenticated users to `/login`.
- New `AdminUsersPage.tsx` (reachable only via the `SUPER_ADMIN`-only nav
  item and route):
  - Table: name, email, a chip per granted screen, a "Remove" button per row
    (disabled on your own row).
  - "New admin" form: name, email, password, one checkbox per screen —
    **defaulting to all checked**, so creating an admin never silently locks
    them out of everything; the super admin deliberately unchecks what they
    want restricted.
- `AuthContext` (admin-web) carries `permissions` from the login/`/me`
  response alongside the existing `user` object, for `Layout.tsx` and
  `PermissionedRoute` to read.

## Testing

- `apps/users/src/users/*.spec.ts`: new admin creation (always `ADMIN` role,
  never `SUPER_ADMIN`, permissions validated against the fixed list),
  permission updates, deletion guardrails (self-delete rejected, targeting a
  `SUPER_ADMIN` rejected).
- `apps/api-gateway`: gateway-auth tests for the widened `admin`-tier check
  (both `ADMIN` and `SUPER_ADMIN` pass) and the new screen-permission check
  (an `ADMIN` without a screen's permission gets 403 on that screen's routes,
  `SUPER_ADMIN` always passes).
- `scripts/e2e-happy-path.js`: append a scenario — log in as the seeded
  super admin, create a restricted admin (e.g. `orders` only), log in as
  that admin, assert `/admin/products` returns 403 while `/admin/orders`
  succeeds, then delete the restricted admin as the super admin.
- Manual: admin-web nav hiding/showing correctly per permission set, direct
  URL navigation to a disallowed screen redirecting, self-delete button
  disabled.

## Out of scope (explicitly deferred)

- View vs. edit granularity within a screen — whole-screen toggle only.
- Promoting an `ADMIN` to `SUPER_ADMIN`, or creating a second super admin,
  through any UI or endpoint — manual/DB action only.
- Token revocation / immediate effect of permission or removal changes.
- Any customer-facing change — this spec touches only `ADMIN`/`SUPER_ADMIN`
  accounts and admin-web.
