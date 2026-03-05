/**
 * DTO for WhatsApp webhook verification request
 * Used when Meta validates the webhook endpoint
 */
export class WebhookVerificationDto {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

