/**
 * DTO for incoming WhatsApp webhook payload
 * Represents the structure of messages received from Meta
 */
export class WebhookPayloadDto {
  object: string;
  entry: WebhookEntryDto[];
}

export class WebhookEntryDto {
  id: string;
  changes: WebhookChangeDto[];
}

export class WebhookChangeDto {
  value: WebhookValueDto;
  field: string;
}

export class WebhookValueDto {
  messaging_product: string;
  metadata: WebhookMetadataDto;
  contacts?: WebhookContactDto[];
  messages?: WebhookMessageDto[];
  statuses?: any[]; // Para notificaciones de estado de mensajes
}

export class WebhookMetadataDto {
  display_phone_number: string;
  phone_number_id: string;
}

export class WebhookContactDto {
  profile: {
    name: string;
  };
  wa_id: string;
}

export class WebhookMessageDto {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: {
    mime_type: string;
    sha256: string;
    id: string;
  };
  audio?: {
    mime_type: string;
    sha256: string;
    id: string;
    voice: boolean;
  };
  video?: {
    mime_type: string;
    sha256: string;
    id: string;
  };
  document?: {
    mime_type: string;
    sha256: string;
    id: string;
    filename: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}
