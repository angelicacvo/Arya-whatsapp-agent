import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PriceComparisonService } from './price-comparison.service';

@Module({
  imports: [HttpModule],
  providers: [PriceComparisonService],
  exports: [PriceComparisonService],
})
export class PriceComparisonModule {}
