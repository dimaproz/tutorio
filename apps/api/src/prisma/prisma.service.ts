import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // Connection is lazy (on first query) so that OpenAPI generation and unit
  // tests do not require a live database.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
