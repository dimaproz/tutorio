import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Tutorio API')
    .setDescription('Financial calendar for private tutors')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  // cleanupOpenApiDoc fixes the schema output produced by nestjs-zod DTOs.
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
