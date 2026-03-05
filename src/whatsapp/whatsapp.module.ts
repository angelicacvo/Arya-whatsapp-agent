import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { HttpModule } from '@nestjs/axios';
import { OpenaiModule } from '../openai/openai.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [HttpModule, OpenaiModule, DatabaseModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
