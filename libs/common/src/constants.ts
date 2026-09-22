export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';

/** Header a downstream service (products, inventory, cart, ...) requires on every call that did not come through the gateway's own trusted network path. */
export const INTERNAL_KEY_HEADER = 'x-internal-key';

/** Headers the gateway sets after verifying a JWT, so downstream services can trust the caller's identity without re-verifying the token. */
export const USER_ID_HEADER = 'x-user-id';
export const USER_ROLE_HEADER = 'x-user-role';
