import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { map, catchError, lastValueFrom } from 'rxjs';
import { OpenaiService } from '../openai/openai.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly config: { headers: Record<string, string> };
  private readonly verifyToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly openaiService: OpenaiService,
    private readonly databaseService: DatabaseService,
  ) {
    const version = this.configService.get<string>('WHATSAPP_CLOUD_API_VERSION') || 'v22.0';
    const phoneId = this.configService.get<string>('WHATSAPP_CLOUD_API_PHONE_NUMBER_ID') || '';
    const token = this.configService.get<string>('WHATSAPP_CLOUD_API_ACCESS_TOKEN') || '';
    this.verifyToken = this.configService.get<string>('WHATSAPP_CLOUD_API_WEBHOOK_VERIFICATION') || '';
    this.apiUrl = `https://graph.facebook.com/${version}/${phoneId}/messages`;

    this.config = {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    };

    if (!phoneId || !token || !this.verifyToken) {
      throw new Error('Missing WhatsApp config. Check .env');
    }
  }

  verifyWebhook(mode: string, token: string): boolean {
    return mode === 'subscribe' && token === this.verifyToken?.trim();
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    const payload = { messaging_product: 'whatsapp', status: 'read', message_id: messageId };

    try {
      const response$ = this.httpService.post(this.apiUrl, JSON.stringify(payload), this.config).pipe(
        map((res) => res.data),
        catchError((error) => {
          this.logger.error(`Read mark error: ${error.message}`);
          throw new BadRequestException('Read mark failed');
        }),
      );
      await lastValueFrom(response$);
      this.logger.log(`Message marked as read: ${messageId}`);
    } catch (error) {
      this.logger.warn(`Read mark failed: ${error.message}`);
    }
  }

  async sendTextMessage(to: string, text: string, replyToMessageId?: string): Promise<any> {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    };

    if (replyToMessageId) payload.context = { message_id: replyToMessageId };

    try {
      const response$ = this.httpService.post(this.apiUrl, JSON.stringify(payload), this.config).pipe(
        map((res) => res.data),
        catchError((error) => {
          this.logger.error(`Send error: ${error.message}`, error.response?.data);
          throw new BadRequestException(`API error: ${error.response?.data?.error?.message || error.message}`);
        }),
      );

      const result = await lastValueFrom(response$);
      this.logger.log(`Message sent to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Send failed: ${error.message}`);
      throw error;
    }
  }

  async generateWhatsAppResponse(userMessage: string, userPhone?: string): Promise<string> {
    if (!userMessage || userMessage.trim().length === 0) {
      this.logger.warn('Empty message received');
      return this.invalidMsg();
    }

    this.logger.log(`Processing message: "${userMessage.substring(0, 50)}"`);

    const intent = await this.openaiService.analyzeUserIntent(userMessage);
    this.logger.log(`Intent: ${intent.intent}, Product: ${intent.product || 'none'}`);

    let response: string;

    if (intent.intent === 'purchase_advice' && intent.product) {
      this.logger.log(`Generating purchase advice for: ${intent.product}`);
      response = await this.openaiService.generatePurchaseAdvice(intent.product);
    } else if (intent.intent === 'farewell') {
      this.logger.log('User farewell');
      response = this.farewellMsg();
    } else {
      this.logger.log('Out-of-scope message');
      response = this.outOfScopeMsg();
    }

    if (userPhone) {
      await this.databaseService.saveConversation({
        user_phone: userPhone,
        message: userMessage,
        intent: intent.intent,
        product: intent.product || undefined,
        bot_response: response,
      });
    }

    return response;
  }

  private outOfScopeMsg(): string {
    return `¡Hola! 👋 Soy *Arya*, tu asistente de compras en Colombia.

Puedo ayudarte a comparar precios de productos. Algunos ejemplos:
- "¿Cuánto cuesta un iPhone 13?"
- "Precio de PlayStation 5"
- "Comida para gatos"

¿Qué producto deseas consultar?`;
  }

  private farewellMsg(): string {
    return `¡Gracias por usar *Arya*! 😊

Espero haberte ayudado a encontrar los mejores precios.

¡Vuelve cuando necesites! 👋`;
  }

  private invalidMsg(): string {
    return `No entendí tu mensaje. 🤔

Por favor dime qué producto deseas consultar.`;
  }
}
