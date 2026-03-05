import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Repository } from 'typeorm';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let repository: Repository<Conversation>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    repository = module.get<Repository<Conversation>>(getRepositoryToken(Conversation));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveConversation', () => {
    it('should save conversation successfully', async () => {
      const mockConversation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_phone: '573001234567',
        message: '¿Cuánto cuesta un iPhone?',
        intent: 'purchase_advice' as const,
        product: 'iPhone',
        bot_response: 'Encontré varias opciones...',
        created_at: new Date(),
      };

      mockRepository.create.mockReturnValue(mockConversation);
      mockRepository.save.mockResolvedValue(mockConversation);

      const result = await service.saveConversation({
        user_phone: '573001234567',
        message: '¿Cuánto cuesta un iPhone?',
        intent: 'purchase_advice',
        product: 'iPhone',
        bot_response: 'Encontré varias opciones...',
      });

      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(mockRepository.create).toHaveBeenCalledWith({
        user_phone: '573001234567',
        message: '¿Cuánto cuesta un iPhone?',
        intent: 'purchase_advice',
        product: 'iPhone',
        bot_response: 'Encontré varias opciones...',
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should save conversation without product', async () => {
      const mockConversation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_phone: '573001234567',
        message: 'Hola',
        intent: 'other' as const,
        bot_response: 'Soy Arya...',
        created_at: new Date(),
      };

      mockRepository.create.mockReturnValue(mockConversation);
      mockRepository.save.mockResolvedValue(mockConversation);

      const result = await service.saveConversation({
        user_phone: '573001234567',
        message: 'Hola',
        intent: 'other',
        bot_response: 'Soy Arya...',
      });

      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should save farewell conversation', async () => {
      const mockConversation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_phone: '573001234567',
        message: 'no gracias',
        intent: 'farewell' as const,
        bot_response: '¡Gracias por usar Arya!',
        created_at: new Date(),
      };

      mockRepository.create.mockReturnValue(mockConversation);
      mockRepository.save.mockResolvedValue(mockConversation);

      const result = await service.saveConversation({
        user_phone: '573001234567',
        message: 'no gracias',
        intent: 'farewell',
        bot_response: '¡Gracias por usar Arya!',
      });

      expect(result).not.toBeNull();
    });

    it('should return null on save error', async () => {
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      const result = await service.saveConversation({
        user_phone: '573001234567',
        message: 'test',
        intent: 'other',
        bot_response: 'test response',
      });

      expect(result).toBeNull();
    });
  });

  describe('getUserConversations', () => {
    it('should retrieve user conversations', async () => {
      const mockConversations = [
        {
          id: '1',
          user_phone: '573001234567',
          message: 'Message 1',
          intent: 'purchase_advice' as const,
          bot_response: 'Response 1',
          created_at: new Date('2026-03-05'),
        },
        {
          id: '2',
          user_phone: '573001234567',
          message: 'Message 2',
          intent: 'other' as const,
          bot_response: 'Response 2',
          created_at: new Date('2026-03-04'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockConversations);

      const result = await service.getUserConversations('573001234567');

      expect(result).toEqual(mockConversations);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { user_phone: '573001234567' },
        order: { created_at: 'DESC' },
        take: 10,
      });
    });

    it('should apply custom limit', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.getUserConversations('573001234567', 5);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { user_phone: '573001234567' },
        order: { created_at: 'DESC' },
        take: 5,
      });
    });

    it('should return empty array on error', async () => {
      mockRepository.find.mockRejectedValue(new Error('Database error'));

      const result = await service.getUserConversations('573001234567');

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should retrieve statistics successfully', async () => {
      mockRepository.count.mockResolvedValueOnce(100);
      mockRepository.count.mockResolvedValueOnce(75);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { user_phone: '573001234567' },
          { user_phone: '573007654321' },
          { user_phone: '573009876543' },
        ]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getStats();

      expect(result).toEqual({
        totalConversations: 100,
        totalUsers: 3,
        purchaseIntents: 75,
      });
    });

    it('should return null on error', async () => {
      mockRepository.count.mockRejectedValue(new Error('Database error'));

      const result = await service.getStats();

      expect(result).toBeNull();
    });

    it('should handle empty database', async () => {
      mockRepository.count.mockResolvedValueOnce(0);
      mockRepository.count.mockResolvedValueOnce(0);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getStats();

      expect(result).toEqual({
        totalConversations: 0,
        totalUsers: 0,
        purchaseIntents: 0,
      });
    });
  });
});
