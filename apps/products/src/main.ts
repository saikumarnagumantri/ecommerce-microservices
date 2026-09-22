import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { applyCommonGlobals } from '@salescart/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyCommonGlobals(app, { strict: true });

  const config = new DocumentBuilder()
    .setTitle('Products API')
    .setDescription('Products service APIs')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
