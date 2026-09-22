import 'dotenv/config';
import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { applyCommonGlobals } from '@salescart/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './media/media.constants';

async function bootstrap() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  applyCommonGlobals(app, { strict: true });

  // Express's static handler supports HTTP range requests natively, so
  // video files served from here can be scrubbed/streamed, not just
  // downloaded whole.
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/media/' });

  const config = new DocumentBuilder()
    .setTitle('Product Image API')
    .setDescription('Media upload service for product images and videos')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3005);
}
bootstrap();
