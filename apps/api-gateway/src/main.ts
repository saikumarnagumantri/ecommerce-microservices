import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { applyCommonGlobals } from '@salescart/common';
import express, { type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { AppModule } from './app.module';
import { ProxyService } from './gateway/proxy.service';
import { checkAuth } from './gateway/gateway-auth';
import { GatewayHttpError } from './gateway/gateway-http-error';
import { getMergedOpenApiDoc } from './gateway/docs';

// Reflecting any origin (`origin: true`) with `credentials: true` passes a
// browser-security checklist item regardless of today's actual risk, since
// this API is Bearer-token (not cookie) authenticated. Default to the
// known local dev origins (admin-web's Vite server, Expo's web/dev
// server); override with a comma-separated CORS_ORIGINS for any other
// environment.
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://localhost:19006',
];

function resolveAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS;
  if (!configured) return DEFAULT_DEV_ORIGINS;
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyCommonGlobals(app);

  const allowedOrigins = resolveAllowedOrigins();
  app.enableCors({
    origin(origin, callback) {
      // No Origin header at all (native app requests, curl, server-to-server)
      // isn't a browser CORS scenario — nothing to restrict.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  });

  // Nest's own default body-parser registers too late relative to the
  // app.use() calls below (it's wired up at listen()/init() time, after
  // these), so req.body would otherwise still be unparsed when the proxy
  // handler runs. These only touch matching content-types and leave a
  // multipart/form-data upload's raw stream untouched, which the proxy
  // needs intact to pipe straight through.
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging (E6-3) — one line per request, with latency.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[gateway] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  // Rate limit login/register specifically (E6-3) — everything else is
  // unthrottled at the gateway (a service can still protect itself).
  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { statusCode: 429, error: 'Too Many Requests', message: 'Too many attempts — try again shortly.' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // Unified Swagger docs (E6-4): merges every service's own /api-json.
  app.use('/api/docs-json', (req: Request, res: Response) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    getMergedOpenApiDoc(origin).then((doc) => res.json(doc));
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerOptions: { url: '/api/docs-json' } }));

  // Everything else under /api/* is proxied to the right service, after
  // this gateway's own auth check (E6-1, E6-2).
  const proxyService = app.get(ProxyService);
  app.use('/api', (req: Request, res: Response) => {
    try {
      const { route } = checkAuth(req, req.path);
      void proxyService.forward(req, res, route, req.path);
    } catch (err) {
      if (err instanceof GatewayHttpError) {
        res.status(err.statusCode).json(err.toBody(req.originalUrl));
      } else {
        console.error(err);
        res.status(500).json({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Unexpected gateway error',
          path: req.originalUrl,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
