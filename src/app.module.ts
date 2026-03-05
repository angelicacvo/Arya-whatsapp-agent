import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConfigModule } from '@nestjs/config';
import { OpenaiService } from './openai/openai.service';


@Module({
  imports: [
    WhatsappModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    })],
  controllers: [AppController],
  providers: [AppService, OpenaiService],
})
export class AppModule { }
