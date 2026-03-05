import { Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { PriceComparisonModule } from '../price-comparison/price-comparison.module';

@Module({
  imports: [PriceComparisonModule],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
