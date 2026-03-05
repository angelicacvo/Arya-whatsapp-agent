import {
  Controller,
  Get,
  Post,
  Req,
  Body,
  HttpCode,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappService } from './whatsapp.service';

/**
 * Controller that handles WhatsApp Cloud API endpoints
 * Controlador para los endpoints de WhatsApp Cloud API
 * 
 * GET /whatsapp/webhook - Webhook verification by Meta
 * POST /whatsapp/webhook - Receive messages and notifications from WhatsApp
 */
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  /**
   * Webhook verification endpoint
   * Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge
   * We must validate the token and return the challenge to verify ownership
   */
  @Get('webhook')
  verifyWebhook(@Req() request: Request): string {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (!mode || !token) {
      this.logger.warn('Webhook verification failed: missing parameters');
      return 'Error verifying webhook';
    }

    const isValid = this.whatsappService.verifyWebhook(
      mode as string,
      token as string,
    );

    if (isValid) {
      this.logger.log('✅ Webhook verification successful');
      return challenge?.toString() || '';
    }

    this.logger.error('❌ Webhook verification failed: Invalid token');
    return 'Verification failed';
  }

  /**
   * Webhook receiver endpoint
   * Meta sends POST requests here with messages and status updates
   * Must respond with 200 OK quickly to avoid retries
   */
  @Post('webhook')
  @HttpCode(200)
  async receiveMessage(@Body() body: any): Promise<string> {
    this.logger.log('===== WEBHOOK RECEIVED =====');

    try {
      // Extract messages from webhook payload / Extraer mensajes del payload
      const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages;
      
      if (!messages || messages.length === 0) {
        this.logger.log('No messages to process (might be a status update)');
        return 'No messages';
      }

      // Process the first message / Procesar el primer mensaje
      const message = messages[0];
      const messageSender = message.from;
      const messageId = message.id;
      const messageType = message.type;

      this.logger.log(
        `Processing message from ${messageSender}, type: ${messageType}, id: ${messageId}`,
      );

      // Mark message as read with typing indicator
      // Marcar mensaje como leído con indicador de escritura
      await this.whatsappService.markMessageAsRead(messageId);

      // Handle different message types / Manejar diferentes tipos de mensaje
      if (messageType === 'text') {
        const textBody = message.text?.body;
        if (!textBody) {
          this.logger.warn('Text message received but body is empty');
          return 'Empty message';
        }

        this.logger.log(`Received text: "${textBody}"`);
        
        // Send response with context (reply to original message)
        // Enviar respuesta con contexto (responder al mensaje original)
        await this.whatsappService.sendTextMessage(
          messageSender,
          `Recibí tu mensaje: ${textBody}`,
          messageId,
        );
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
