import { Controller, Get, Post, Req, Body, HttpCode, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('webhook')
  verifyWebhook(@Req() request: Request): string {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (!mode || !token) {
      this.logger.warn('Webhook verification failed: missing parameters');
      return 'Error verifying webhook';
    }

    const isValid = this.whatsappService.verifyWebhook(mode as string, token as string);

    if (isValid) {
      this.logger.log('Webhook verified successfully');
      return challenge?.toString() || '';
    }

    this.logger.error('Webhook verification failed: invalid token');
    return 'Verification failed';
  }

  @Post('webhook')
  @HttpCode(200)
  async receiveMessage(@Body() body: any): Promise<string> {
    this.logger.log('Webhook received');

    try {
      const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages;
      
      if (!messages || messages.length === 0) {
        this.logger.log('No messages to process');
        return 'No messages';
      }

      const message = messages[0];
      const { from: messageSender, id: messageId, type: messageType } = message;

      this.logger.log(`Processing ${messageType} from ${messageSender} [${messageId}]`);

      await this.whatsappService.markMessageAsRead(messageId);

      if (messageType === 'text') {
        const textBody = message.text?.body;
        
        if (!textBody) {
          this.logger.warn('Empty text message received');
          return 'Empty message';
        }

        this.logger.log(`Text: "${textBody}"`);
        
        const aiResponse = await this.whatsappService.generateWhatsAppResponse(textBody, messageSender);
        await this.whatsappService.sendTextMessage(messageSender, aiResponse);
      } else {
        this.logger.warn(`Unsupported message type: ${messageType}`);
      }

      return 'Message processed';
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`);
      return 'Error processing message';
    }
  }
}
