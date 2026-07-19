import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // Подключение ленивое (первый запрос) — чтобы генерация OpenAPI и юнит-тесты
  // не требовали живой базы данных.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
