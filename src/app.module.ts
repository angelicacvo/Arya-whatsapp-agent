import { Module } from '@nestjs/common';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConfigModule } from '@nestjs/config';
import { OpenaiService } from './openai/openai.service';
import { OpenaiModule } from './openai/openai.module';


@Module({
  imports: [
    WhatsappModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    OpenaiModule],
  controllers: [],
  providers: [OpenaiService],
})
export class AppModule { }
