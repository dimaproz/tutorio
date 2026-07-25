import { Module } from '@nestjs/common';
import { MaterializerService } from './materializer.service';

/**
 * The series materializer stands alone so both scheduling and packages can use
 * it without importing each other: a package provisions a series, and the
 * ledger re-books a replacement lesson from one.
 */
@Module({
  providers: [MaterializerService],
  exports: [MaterializerService],
})
export class MaterializerModule {}
