import { Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';
import { RouteRule } from './gateway.routes';

const INTERNAL_KEY_HEADER = 'x-internal-key';
// Headers that only make sense for the original hop, never forwarded.
const HOP_BY_HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  async forward(req: Request, res: Response, route: RouteRule, apiPath: string): Promise<void> {
    const targetUrl = `${route.target}${apiPath}`;
    const isMultipart = (req.headers['content-type'] ?? '').startsWith('multipart/');

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && !HOP_BY_HOP.has(key.toLowerCase())) {
        headers[key] = value;
      }
    }
    headers[INTERNAL_KEY_HEADER] = process.env.INTERNAL_API_KEY ?? '';

    const start = Date.now();
    try {
      const upstream = await axios.request({
        method: req.method as any,
        url: targetUrl,
        headers,
        // A multipart body was never parsed by Nest's body parser (it
        // only handles json/urlencoded), so the raw request is still a
        // readable stream here — pipe it through untouched. Everything
        // else was already parsed into req.body; re-serialize that.
        data: isMultipart ? req : ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
        params: req.query,
        responseType: 'stream',
        validateStatus: () => true,
        maxRedirects: 0,
      });

      res.status(upstream.status);
      for (const [key, value] of Object.entries(upstream.headers)) {
        if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) {
          res.setHeader(key, value as string | string[]);
        }
      }
      upstream.data.pipe(res);
    } catch (err) {
      this.logger.error(`Proxy to ${targetUrl} failed: ${err instanceof Error ? err.message : err}`);
      res.status(502).json({
        statusCode: 502,
        error: 'Bad Gateway',
        message: `${route.target.split('//')[1]?.split(':')[0] ?? 'Upstream service'} is unavailable`,
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.logger.log(`${req.method} ${req.originalUrl} -> ${targetUrl} (${Date.now() - start}ms)`);
    }
  }
}
