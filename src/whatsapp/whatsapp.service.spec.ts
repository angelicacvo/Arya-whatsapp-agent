import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappService } from './whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { OpenaiService } from '../openai/openai.service';
import { DatabaseService } from '../database/database.service';
import { of, throwError } from 'rxjs';
import { BadRequestException } from '@nestjs/common';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let httpService: HttpService;
  let openaiService: OpenaiService;
  let databaseService: DatabaseService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        WHATSAPP_CLOUD_API_VERSION: 'v22.0',
        WHATSAPP_CLOUD_API_PHONE_NUMBER_ID: '123456',
        WHATSAPP_CLOUD_API_ACCESS_TOKEN: 'test_token',
        WHATSAPP_CLOUD_API_WEBHOOK_VERIFICATION: 'test_verify_token',
      };
      return config[key];
    }),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockOpenaiService = {
    analyzeUserIntent: jest.fn(),
    generatePurchaseAdvice: jest.fn(),
  };

  const mockDatabaseService = {
    saveConversation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: OpenaiService, useValue: mockOpenaiService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
    httpService = module.get<HttpService>(HttpService);
    openaiService = module.get<OpenaiService>(OpenaiService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyWebhook', () => {
    it('should return true for valid webhook verification', () => {
      const result = service.verifyWebhook('subscribe', 'test_verify_token');
      expect(result).toBe(true);
    });

    it('should return false for invalid mode', () => {
      const result = service.verifyWebhook('invalid', 'test_verify_token');
      expect(result).toBe(false);
    });

    it('should return false for invalid token', () => {
      const result = service.verifyWebhook('subscribe', 'wrong_token');
      expect(result).toBe(false);
    });

    it('should reject token with extra whitespace', () => {
      const result = service.verifyWebhook('subscribe', ' test_verify_token ');
      expect(result).toBe(false);
    });
  });

  describe('markMessageAsRead', () => {
    it('should successfully mark message as read', async () => {
      mockHttpService.post.mockReturnValue(
        of({ data: { success: true } })
      );

      await service.markMessageAsRead('msg_123');

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('messages'),
        expect.stringContaining('msg_123'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle errors when marking message as read', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('API error'))
      );

      await expect(service.markMessageAsRead('msg_123')).resolves.not.toThrow();
    });
  });

  describe('sendTextMessage', () => {
    it('should send text message successfully', async () => {
      const mockResponse = { messages: [{ id: 'wamid.123' }] };
      mockHttpService.post.mockReturnValue(of({ data: mockResponse }));

      const result = await service.sendTextMessage('573001234567', 'Hello World');

      expect(result).toEqual(mockResponse);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Hello World'),
        expect.any(Object)
      );
    });

    it('should send message with reply context', async () => {
      mockHttpService.post.mockReturnValue(of({ data: { success: true } }));

      await service.sendTextMessage('573001234567', 'Reply', 'msg_123');

      const callArgs = mockHttpService.post.mock.calls[0];
      const payload = JSON.parse(callArgs[1]);
      
      expect(payload.context).toEqual({ message_id: 'msg_123' });
    });

    it('should handle send message errors', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({
          message: 'API Error',
          response: { data: { error: { message: 'Rate limit exceeded' } } },
        }))
      );

      await expect(
        service.sendTextMessage('573001234567', 'Test')
      ).rejects.toThrow();
    });
  });

  describe('generateWhatsAppResponse', () => {
    it('should return invalid message for empty input', async () => {
      const response = await service.generateWhatsAppResponse('', '573001234567');
      expect(response).toContain('No entendí tu mensaje');
    });

    it('should handle purchase_advice intent', async () => {
      mockOpenaiService.analyzeUserIntent.mockResolvedValue({
        intent: 'purchase_advice',
        product: 'iPhone 13',
      });
      mockOpenaiService.generatePurchaseAdvice.mockResolvedValue(
        'Encontré varias opciones de iPhone 13...'
      );

      const response = await service.generateWhatsAppResponse(
        '¿Cuánto cuesta un iPhone 13?',
        '573001234567'
      );

      expect(response).toContain('iPhone 13');
      expect(mockOpenaiService.analyzeUserIntent).toHaveBeenCalled();
      expect(mockOpenaiService.generatePurchaseAdvice).toHaveBeenCalledWith('iPhone 13');
      expect(mockDatabaseService.saveConversation).toHaveBeenCalled();
    });

    it('should handle farewell intent', async () => {
      mockOpenaiService.analyzeUserIntent.mockResolvedValue({
        intent: 'farewell',
        product: null,
      });

      const response = await service.generateWhatsAppResponse(
        'no gracias',
        '573001234567'
      );

      expect(response).toContain('Gracias');
      expect(response).toContain('Arya');
    });

    it('should handle out-of-scope intent', async () => {
      mockOpenaiService.analyzeUserIntent.mockResolvedValue({
        intent: 'other',
        product: null,
      });

      const response = await service.generateWhatsAppResponse(
        'Hola',
        '573001234567'
      );

      expect(response).toContain('Arya');
      expect(response).toContain('asistente de compras');
    });

    it('should save conversation to database', async () => {
      mockOpenaiService.analyzeUserIntent.mockResolvedValue({
        intent: 'other',
        product: null,
      });

      await service.generateWhatsAppResponse('test', '573001234567');

      expect(mockDatabaseService.saveConversation).toHaveBeenCalledWith({
        user_phone: '573001234567',
        message: 'test',
        intent: 'other',
        product: undefined,
        bot_response: expect.any(String),
      });
    });

    it('should work without user phone', async () => {
      mockOpenaiService.analyzeUserIntent.mockResolvedValue({
        intent: 'other',
        product: null,
      });

      const response = await service.generateWhatsAppResponse('test');

      expect(response).toBeDefined();
      expect(mockDatabaseService.saveConversation).not.toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it('should throw error if WhatsApp config is missing', () => {
      const badConfigService = {
        get: jest.fn(() => ''),
      };

      expect(() => {
        new WhatsappService(
          badConfigService as any,
          httpService,
          openaiService,
          databaseService
        );
      }).toThrow('Missing WhatsApp config');
    });
  });
});
