# @salescart/common

Shared cross-cutting building blocks for every SalesCart service: a global
validation pipe, a consistent error response shape, JWT/roles/internal-key
guards, and a pagination helper. See `src/index.ts` for the full export list.

## How services consume this library

There is no npm workspace or monorepo tool in this repo, so this library is
distributed to each service as a **packed tarball**, not a raw directory
reference. Each service's `package.json` depends on it as:

```
"@salescart/common": "file:../../libs/common/salescart-common-<version>.tgz"
```

**Why not just `file:../../libs/common`?** npm turns a bare directory
`file:` dependency into a symlink. Node resolves a symlinked module's own
`require()` calls from its *real* path (`libs/common/...`), not from where
it's linked into the consuming app (`apps/products/node_modules/...`). That
breaks two things at once:
1. Anything this library requires (`@nestjs/common`, `class-validator`, ...)
   has to be resolvable by walking up from `libs/common`'s real location,
   which is a different node_modules tree than the app that uses it.
2. Worse, if you paper over that by installing `@nestjs/common` somewhere
   both trees can reach, the library ends up running against a *different
   instance* of `@nestjs/common` than the app does. `instanceof` checks
   across two instances of the "same" class fail silently — concretely,
   `exception instanceof HttpException` inside `AllExceptionsFilter` came
   back `false` for a real `BadRequestException`, and every error was
   reported as a 500. A packed tarball avoids both problems: npm extracts
   a real, non-symlinked copy into the consuming app's own
   `node_modules/@salescart/common`, so its `require('@nestjs/common')`
   resolves to that same app's own copy, one instance, no ambiguity.

## After changing anything in `src/`

npm caches a local tarball dependency somewhat aggressively; overwriting
the `.tgz` in place at the same filename is not reliably picked up by a
plain `npm install` in the consuming apps. Bump the version so the
filename changes, which forces a real reinstall everywhere:

```sh
cd libs/common
npm version patch --no-git-tag-version   # or edit package.json by hand
npm run build
rm -f *.tgz
npm pack --pack-destination .

# then, for every app that depends on this library:
cd ../../apps/<app>
# update the version in the "@salescart/common" file: path in package.json
rm -rf node_modules/@salescart/common
npm install
npm run build   # or `nest build`
```

Root scripts to do this across all apps in one step are planned for E0-5.

## What's wired in today vs. what's ready but not yet turned on

`applyCommonGlobals(app)` (called from every service's `main.ts`) applies:
- **A global validation pipe.** `transform: true` always; `whitelist` /
  `forbidNonWhitelisted` default to `false` and are **opt-in per service**
  via `applyCommonGlobals(app, { strict: true })`, because none of the
  DTOs in this codebase have `class-validator` decorators yet (only
  `@ApiProperty` for Swagger) — turning on whitelisting before that would
  mark every field "unknown" and reject every existing request body. Turn
  `strict: true` on for a service once its DTOs are decorated (starting
  with the DTOs introduced in E1 registration/login and E2 admin CRUD).
- **A global exception filter** that normalizes every error response to
  `{ statusCode, error, message, path, timestamp }`.

**Not yet wired into any controller:** `JwtAuthGuard`, `RolesGuard`,
`InternalKeyGuard`, `@Roles()`, `@Public()`, `@CurrentUser()`. They're
built and unit-tested, but there's nothing yet to authenticate against
(no login exists before E1-2) and no gateway forwarding the internal key
(before E6-1) — enabling them now would lock every service out. Adopt
`JwtAuthGuard`/`RolesGuard` in the gateway in E6-2, and `InternalKeyGuard`
per downstream service in E6-1.
