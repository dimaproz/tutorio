import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/swagger';

// Выгружает openapi.json без запуска HTTP-сервера и без подключения к БД
// (PrismaService подключается лениво). Результат забирает packages/api-client.
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const document = buildOpenApiDocument(app);
  const outPath = resolve(__dirname, '../../../packages/api-client/openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));

  await app.close();
  console.log(`OpenAPI schema written to ${outPath}`);
}

void main();
