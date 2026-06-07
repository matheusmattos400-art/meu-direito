import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: [
      config.get<string>('WEB_URL') ?? 'http://localhost:3000',
      config.get<string>('ADMIN_URL') ?? 'http://localhost:3001',
    ],
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LegalTech API')
    .setDescription('API da plataforma SaaS de LegalTech (nome do produto a definir).')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('API_PORT') ?? 3333;
  await app.listen(port);
  Logger.log(`API em http://localhost:${port}/api — docs em /docs`, 'Bootstrap');
}

void bootstrap();
