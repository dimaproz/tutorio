import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Prisma's 5s default for interactive transactions assumes the database is a
// hop away. Booking a lesson runs a dozen sequential round trips inside one
// transaction, so a managed database on the other side of a proxy (~240ms per
// query in development) blows through it while doing nothing wrong. The ceiling
// is an upper bound, not a delay: a healthy transaction still finishes in
// milliseconds against a colocated database.
const TRANSACTION_TIMEOUT_MS = 20_000;
/** How long a transaction may wait for a free connection before giving up. */
const TRANSACTION_MAX_WAIT_MS = 10_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      transactionOptions: {
        timeout: TRANSACTION_TIMEOUT_MS,
        maxWait: TRANSACTION_MAX_WAIT_MS,
      },
    });
  }

  // Connection is lazy (on first query) so that OpenAPI generation and unit
  // tests do not require a live database.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
