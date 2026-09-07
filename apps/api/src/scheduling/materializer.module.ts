import { Module } from '@nestjs/common';
import { MaterializerService } from './materializer.service';

/**
 * The series materializer stands alone so both scheduling and packages can use
 * it without importing each other: a package provisions a series and no
 * cancellation creates a fictional replacement occurrence.
 */
@Module({
  providers: [MaterializerService],
  exports: [MaterializerService],
})
export class MaterializerModule {}
