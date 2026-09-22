import axios from 'axios';
import { Logger } from '@nestjs/common';

const logger = new Logger('GatewayDocs');

/** Every service that hosts its own Swagger doc at GET /api-json (NestJS's SwaggerModule.setup default). */
function serviceUrls(): string[] {
  return [
    process.env.USERS_URL ?? 'http://localhost:3006',
    process.env.PRODUCTS_URL ?? 'http://localhost:3002',
    process.env.INVENTORY_URL ?? 'http://localhost:3003',
    process.env.CART_URL ?? 'http://localhost:3004',
    process.env.ORDERS_URL ?? 'http://localhost:3007',
    process.env.PRODUCT_IMAGE_URL ?? 'http://localhost:3005',
  ];
}

/**
 * Builds one OpenAPI document by fetching and merging every service's
 * own doc. Refetched on every call (this is a low-traffic docs endpoint)
 * so a service that was down at gateway boot still appears once it's up.
 * A service that can't be reached is skipped rather than failing the
 * whole page.
 */
export async function getMergedOpenApiDoc(gatewayOrigin: string): Promise<object> {
  const results = await Promise.allSettled(
    serviceUrls().map((url) => axios.get(`${url}/api-json`, { timeout: 3000 })),
  );

  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = {};

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      logger.warn(`Could not fetch docs from ${serviceUrls()[i]}: ${result.reason?.message ?? result.reason}`);
      return;
    }
    const doc = result.value.data;
    Object.assign(paths, doc.paths ?? {});
    Object.assign(schemas, doc.components?.schemas ?? {});
  });

  return {
    openapi: '3.0.0',
    info: {
      title: 'SalesCart API',
      description: 'Unified docs for every route reachable through the gateway.',
      version: '1.0',
    },
    servers: [{ url: `${gatewayOrigin}/api` }],
    paths,
    components: { schemas, securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  };
}
