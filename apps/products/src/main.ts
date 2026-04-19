import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
   const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Products API')
    .setDescription('Products service APIs')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3002);

  // const app = await NestFactory.create(AppModule);
  // await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
