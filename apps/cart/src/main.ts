import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { applyCommonGlobals } from '@salescart/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyCommonGlobals(app);

  const config = new DocumentBuilder()
    .setTitle('CART API')
    .setDescription('CART service APIs')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3004);
}
bootstrap();
