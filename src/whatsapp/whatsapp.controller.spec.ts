import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { Request } from 'express';

describe('WhatsappController', () => {
  let controller: WhatsappController;
  let service: WhatsappService;

  const mockWhatsappService = {
    verifyWebhook: jest.fn(),
    markMessageAsRead: jest.fn(),
    generateWhatsAppResponse: jest.fn(),
    sendTextMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappController],
      providers: [{ provide: WhatsappService, useValue: mockWhatsappService }],
    }).compile();

    controller = module.get<WhatsappController>(WhatsappController);
    service = module.get<WhatsappService>(WhatsappService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyWebhook', () => {
    it('should verify webhook successfully', () => {
      const mockRequest = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_token',
          'hub.challenge': '12345',
        },
      } as unknown as Request;

      mockWhatsappService.verifyWebhook.mockReturnValue(true);

      const result = controller.verifyWebhook(mockRequest);

      expect(result).toBe('12345');
      expect(mockWhatsappService.verifyWebhook).toHaveBeenCalledWith(
        'subscribe',
        'test_token'
      );
    });

    it('should fail verification with invalid token', () => {
      const mockRequest = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': '12345',
        },
      } as unknown as Request;

      mockWhatsappService.verifyWebhook.mockReturnValue(false);

      const result = controller.verifyWebhook(mockRequest);

      expect(result).toBe('Verification failed');
    });

    it('should return error for missing parameters', () => {
      const mockRequest = {
        query: {},
      } as unknown as Request;

      const result = controller.verifyWebhook(mockRequest);

      expect(result).toBe('Error verifying webhook');
    });
  });

  describe('receiveMessage', () => {
    it('should process text message successfully', async () => {
      const mockBody = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '573001234567',
                      id: 'wamid.123',
                      type: 'text',
                      text: { body: '¿Cuánto cuesta un iPhone?' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockWhatsappService.markMessageAsRead.mockResolvedValue(undefined);
      mockWhatsappService.generateWhatsAppResponse.mockResolvedValue(
        'Encontré varias opciones...'
      );
      mockWhatsappService.sendTextMessage.mockResolvedValue({ success: true });

      const result = await controller.receiveMessage(mockBody);

      expect(result).toBe('Message processed');
      expect(mockWhatsappService.markMessageAsRead).toHaveBeenCalledWith('wamid.123');
      expect(mockWhatsappService.generateWhatsAppResponse).toHaveBeenCalledWith(
        '¿Cuánto cuesta un iPhone?',
        '573001234567'
      );
      expect(mockWhatsappService.sendTextMessage).toHaveBeenCalledWith(
        '573001234567',
        'Encontré varias opciones...'
      );
    });

    it('should handle empty messages', async () => {
      const mockBody = {
        entry: [{ changes: [{ value: { messages: [] } }] }],
      };

      const result = await controller.receiveMessage(mockBody);

      expect(result).toBe('No messages');
      expect(mockWhatsappService.markMessageAsRead).not.toHaveBeenCalled();
    });

    it('should handle missing messages array', async () => {
      const mockBody = {
        entry: [{ changes: [{ value: {} }] }],
      };

      const result = await controller.receiveMessage(mockBody);

      expect(result).toBe('No messages');
    });

    it('should handle empty text body', async () => {
      const mockBody = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '573001234567',
                      id: 'wamid.123',
                      type: 'text',
                      text: {},
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockWhatsappService.markMessageAsRead.mockResolvedValue(undefined);

      const result = await controller.receiveMessage(mockBody);

      expect(result).toBe('Empty message');
    });

    it('should handle unsupported message types', async () => {
      const mockBody = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '573001234567',
                      id: 'wamid.123',
                      type: 'image',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockWhatsappService.markMessageAsRead.mockResolvedValue(undefined);

      const result = await controller.receiveMessage(mockBody);

      expect(result).toBe('Message processed');
      expect(mockWhatsappService.sendTextMessage).not.toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      const mockBody = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '573001234567',
                      id: 'wamid.123',
                      type: 'text',
                      text: { body: 'test' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockWhatsappService.markMessageAsRead.mockRejectedValue(
        new Error('Network error')
      );

      const result = await controller.receiveMessage(mockBody);

      expect(result).toBe('Error processing message');
    });
  });
});
