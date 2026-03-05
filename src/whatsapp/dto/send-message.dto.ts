/**
 * DTO for sending text messages via WhatsApp Cloud API
 * Estructura requerida por Meta para enviar mensajes
 */
export class SendMessageDto {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  text: {
    preview_url: boolean;
    body: string;
  };
}

