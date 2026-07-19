import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/swagger';

// Emits openapi.json without starting the HTTP server or connecting to the DB
// (PrismaService connects lazily). The output is consumed by packages/api-client.
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
