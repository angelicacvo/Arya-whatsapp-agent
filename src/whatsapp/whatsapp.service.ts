import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { map, catchError, lastValueFrom } from 'rxjs';

/**
 * Service that handles WhatsApp Cloud API business logic
 * Servicio para la lógica de negocio de WhatsApp Cloud API
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly apiVersion: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly verifyToken: string;
  private readonly config: { headers: Record<string, string> };

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    // Load environment variables / Cargar variables de entorno
    this.apiVersion =
      this.configService.get<string>('WHATSAPP_CLOUD_API_VERSION') || 'v22.0';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_CLOUD_API_PHONE_NUMBER_ID') ||
      '';
    this.accessToken =
      this.configService.get<string>('WHATSAPP_CLOUD_API_ACCESS_TOKEN') || '';
    this.verifyToken =
      this.configService.get<string>('WHATSAPP_CLOUD_API_WEBHOOK_VERIFICATION') ||
      '';

    // Construct API URL / Construir URL de la API
    this.apiUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    // Setup headers / Configurar headers
    this.config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    // Validate required credentials / Validar credenciales requeridas
    if (!this.phoneNumberId || !this.accessToken || !this.verifyToken) {
      throw new Error(
        'Missing required WhatsApp configuration. Check your .env file.',
      );
    }

    this.logger.log('WhatsApp Service initialized successfully');
  }

  /**
   * Verify webhook token from Meta
   * Verifica el token del webhook enviado por Meta
   */
  verifyWebhook(mode: string, token: string): boolean {
    if (mode === 'subscribe' && token === this.verifyToken?.trim()) {
      return true;
    }
    return false;
  }

  /**
   * Mark message as read
   * Marca el mensaje como leído
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    const data = JSON.stringify(payload);

    try {
      const response$ = this.httpService.post(this.apiUrl, data, this.config).pipe(
        map((res) => res.data),
        catchError((error) => {
          this.logger.error('Error marking message as read', error.message);
          throw new BadRequestException('Error marking message as read');
        }),
      );

      await lastValueFrom(response$);
      this.logger.log(`Message marked as read: ${messageId}`);
    } catch (error) {
      this.logger.warn(`Failed to mark message as read: ${error.message}`);
    }
  }

  /**
   * Send text message via WhatsApp Cloud API
   * Envía un mensaje de texto vía WhatsApp Cloud API
   * 
   * @param to - Phone number to send message to / Número de teléfono destino
   * @param text - Message text / Texto del mensaje
   * @param replyToMessageId - Optional: Message ID to reply to (creates thread) / Opcional: ID del mensaje a responder (crea hilo)
   */
  async sendTextMessage(
    to: string,
    text: string,
    replyToMessageId?: string,
  ): Promise<any> {
    // Build message payload according to Meta docs
    // Construir payload del mensaje según documentación de Meta
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    };

    // Add context for reply threading if messageId is provided
    // Agregar contexto para hilos de respuesta si se proporciona messageId
    if (replyToMessageId) {
      payload.context = {
        message_id: replyToMessageId,
      };
    }

    const data = JSON.stringify(payload);

    this.logger.log(`Sending message to ${to}`);

    try {
      const response$ = this.httpService.post(this.apiUrl, data, this.config).pipe(
        map((res) => res.data),
        catchError((error) => {
          this.logger.error(
            `Error sending message: ${error.message}`,
            error.response?.data,
          );
          throw new BadRequestException(
            `WhatsApp API error: ${error.response?.data?.error?.message || error.message}`,
          );
        }),
      );

      const result = await lastValueFrom(response$);
      this.logger.log(`Message sent successfully to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${to}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Send typing indicator to show bot is processing
   * Envía indicador de escritura para mostrar que el bot está procesando
   */
  async sendTypingIndicator(to: string): Promise<void> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        body: 'Processing your data...', // This will show typing indicator
      },
    };

    const data = JSON.stringify(payload);

    try {
      await lastValueFrom(
        this.httpService.post(this.apiUrl, data, this.config).pipe(
          map((res) => res.data),
          catchError((error) => {
            this.logger.error('Error sending typing indicator', error.message);
            throw error;
          }),
        ),
      );
    } catch (error) {
      // Don't throw, typing indicator is not critical
      // No lanzar error, el indicador de escritura no es crítico
    }
  }
}
