import { Test, TestingModule } from '@nestjs/testing';
import { PriceComparisonService } from './price-comparison.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { OpenAI } from 'openai';
import { of, throwError } from 'rxjs';

jest.mock('openai');

describe('PriceComparisonService', () => {
  let service: PriceComparisonService;
  let httpService: HttpService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockCreate: jest.Mock;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        OPENAI_API_KEY: 'test_openai_key',
        SERPAPI_KEY: 'test_serpapi_key',
      };
      return config[key];
    }),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    mockCreate = jest.fn();
    mockOpenAI = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as any;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceComparisonService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<PriceComparisonService>(PriceComparisonService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPriceComparison', () => {
    it('should return empty prices for invalid product', async () => {
      const result = await service.getPriceComparison('');

      expect(result.prices).toHaveLength(0);
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('should handle SQL injection attempts', async () => {
      const result = await service.getPriceComparison("'; DROP TABLE products; --");

      expect(result.prices).toHaveLength(0);
    });

    it('should handle malicious script tags', async () => {
      const result = await service.getPriceComparison('<script>alert("xss")</script>');

      expect(result.prices).toHaveLength(0);
    });

    it('should handle SerpAPI errors gracefully', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API Error'))
      );

      const result = await service.getPriceComparison('iPhone');

      expect(result.prices).toHaveLength(0);
    });

    it('should handle empty search results gracefully', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            organic_results: [],
          },
        } as any)
      );

      const result = await service.getPriceComparison('producto inexistente');

      expect(result.prices).toHaveLength(0);
    });

    it('should handle OpenAI extraction errors gracefully', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            organic_results: [{ title: 'test', url: 'test.com', description: 'test' }],
          },
        } as any)
      );

      mockCreate.mockRejectedValue(new Error('OpenAI Error'));

      const result = await service.getPriceComparison('iPhone');

      expect(result.prices).toHaveLength(0);
    });

    it('should truncate long product names', async () => {
      const longProduct = 'a'.repeat(150);
      
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            organic_results: [],
          },
        } as any)
      );

      await service.getPriceComparison(longProduct);

      const callArgs = mockHttpService.get.mock.calls[0];
      const query = callArgs[1].params.q;
      
      expect(query.length).toBeLessThan(150);
    });
  });

  describe('formatPriceComparisonForPrompt', () => {
    it('should format prices correctly', () => {
      const priceData = {
        product: 'iPhone 13',
        prices: [
          { store: 'MercadoLibre', price: 2500000, rating: 4.5 },
          { store: 'Falabella', price: 2700000 },
        ],
        average_price: 2600000,
        lowest_price: 2500000,
        highest_price: 2700000,
        best_deal_store: 'MercadoLibre',
        best_store: 'MercadoLibre',
        best_price: 2500000,
        savings_percentage: 3.8,
      };

      const result = service.formatPriceComparisonForPrompt(priceData);

      expect(result).toContain('iPhone 13');
      expect(result).toContain('MercadoLibre');
      expect(result).toContain('2.500.000');
      expect(result).toContain('4.5');
    });

    it('should handle empty prices', () => {
      const priceData = {
        product: 'test',
        prices: [],
        average_price: 0,
        best_store: '',
        best_price: 0,
      };

      const result = service.formatPriceComparisonForPrompt(priceData);

      expect(result).toContain('No encontré');
    });
  });

  describe('constructor', () => {
    it('should throw error if OPENAI_API_KEY is missing', () => {
      const badConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'OPENAI_API_KEY') return null;
          return 'test';
        }),
      };

      expect(() => {
        new PriceComparisonService(
          badConfigService as any,
          httpService
        );
      }).toThrow('OPENAI_API_KEY not found');
    });

    it('should work without SERPAPI_KEY', () => {
      const configWithoutSerp = {
        get: jest.fn((key: string) => {
          if (key === 'OPENAI_API_KEY') return 'test_key';
          return null;
        }),
      };

      expect(() => {
        new PriceComparisonService(
          configWithoutSerp as any,
          httpService
        );
      }).not.toThrow();
    });
  });
});
