/**
 * Interfaces para las respuestas de WhatsApp Cloud API
 * Basado en la documentación oficial: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

export interface WhatsAppSendMessageResponse {
  messaging_product: string;
  contacts: {
    input: string;
    wa_id: string;
  }[];
  messages: {
    id: string;
  }[];
}

export interface WhatsAppErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: string;
      details: string;
    };
    fbtrace_id: string;
  };
}

export interface WhatsAppAPIRequestPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    preview_url: boolean;
    body: string;
  };
}
