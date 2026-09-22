import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { applyCommonGlobals } from '@salescart/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyCommonGlobals(app, { strict: true });

  const config = new DocumentBuilder()
    .setTitle('Orders API')
    .setDescription('Order placement, status and tracking')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3007);
}
bootstrap();
