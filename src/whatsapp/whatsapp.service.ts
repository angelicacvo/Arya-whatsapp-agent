import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { map, catchError, lastValueFrom } from 'rxjs';
import { OpenaiService } from '../openai/openai.service';
import { DatabaseService } from '../database/database.service';
import { detectMaliciousInput } from '../common/utils/security.utils';

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
      this.logger.log(`✓ Read: ${messageId}`);
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
      this.logger.log(`✓ Sent to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Send failed: ${error.message}`);
      throw error;
    }
  }

  async generateWhatsAppResponse(userMessage: string, userPhone?: string): Promise<string> {
    if (!userMessage || userMessage.trim().length === 0) {
      this.logger.warn('⚠️ Empty message');
      return this.invalidMsg();
    }

    this.logger.log(`📩 "${userMessage.substring(0, 50)}"`);

    if (detectMaliciousInput(userMessage)) {
      this.logger.warn(`🚨 Malicious: "${userMessage.substring(0, 50)}"`);
      return this.securityMsg();
    }

    const intent = await this.openaiService.analyzeUserIntent(userMessage);
    this.logger.log(`📊 ${intent.intent}, ${intent.product || 'none'}`);

    let response: string;

    if (intent.intent === 'purchase_advice' && intent.product) {
      this.logger.log(`🛍️ Advice: ${intent.product}`);
      response = await this.openaiService.generatePurchaseAdvice(intent.product);
    } else {
      this.logger.log('ℹ️ Out-of-scope');
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
    return `¡Hola! Soy Arya 👋, tu asistente para comparar precios en Colombia.

Ejemplos:
• "¿Cuánto cuesta un iPhone 13?"
• "Precio de PlayStation 5"
• "Pollo de Frisby"

¿Qué producto deseas consultar?`;
  }

  private invalidMsg(): string {
    return 'Por favor envía un mensaje válido con el producto que quieres consultar.';
  }

  private securityMsg(): string {
    return 'Lo siento, tu mensaje no pudo ser procesado. Consulta sobre productos específicos.';
  }
}
