import {
  UserIntentSchema,
  StorePriceSchema,
  PriceComparisonSchema,
  validateUserIntent,
  validatePriceComparison,
} from './schemas.validation';

describe('Schemas Validation', () => {
  describe('UserIntentSchema', () => {
    it('should validate purchase_advice intent', () => {
      const valid = {
        intent: 'purchase_advice',
        product: 'iPhone 13',
      };
      expect(() => UserIntentSchema.parse(valid)).not.toThrow();
    });

    it('should validate farewell intent', () => {
      const valid = {
        intent: 'farewell',
        product: null,
      };
      expect(() => UserIntentSchema.parse(valid)).not.toThrow();
    });

    it('should validate other intent', () => {
      const valid = {
        intent: 'other',
        product: null,
      };
      expect(() => UserIntentSchema.parse(valid)).not.toThrow();
    });

    it('should reject invalid intent', () => {
      const invalid = {
        intent: 'invalid_intent',
        product: null,
      };
      expect(() => UserIntentSchema.parse(invalid)).toThrow();
    });

    it('should reject missing intent', () => {
      const invalid = {
        product: 'test',
      };
      expect(() => UserIntentSchema.parse(invalid)).toThrow();
    });

    it('should reject product longer than 100 characters', () => {
      const invalid = {
        intent: 'purchase_advice',
        product: 'a'.repeat(101),
      };
      expect(() => UserIntentSchema.parse(invalid)).toThrow();
    });

    it('should reject extra fields', () => {
      const invalid = {
        intent: 'other',
        product: null,
        extra_field: 'not allowed',
      };
      expect(() => UserIntentSchema.parse(invalid)).toThrow();
    });
  });

  describe('StorePriceSchema', () => {
    it('should validate store price with rating', () => {
      const valid = {
        store: 'MercadoLibre',
        price: 2500000,
        rating: 4.5,
      };
      expect(() => StorePriceSchema.parse(valid)).not.toThrow();
    });

    it('should validate store price without rating', () => {
      const valid = {
        store: 'Falabella',
        price: 3000000,
      };
      expect(() => StorePriceSchema.parse(valid)).not.toThrow();
    });

    it('should reject empty store name', () => {
      const invalid = {
        store: '',
        price: 1000,
      };
      expect(() => StorePriceSchema.parse(invalid)).toThrow();
    });

    it('should reject store name longer than 50 characters', () => {
      const invalid = {
        store: 'a'.repeat(51),
        price: 1000,
      };
      expect(() => StorePriceSchema.parse(invalid)).toThrow();
    });

    it('should reject non-positive prices', () => {
      const invalid1 = {
        store: 'Store',
        price: 0,
      };
      const invalid2 = {
        store: 'Store',
        price: -100,
      };
      expect(() => StorePriceSchema.parse(invalid1)).toThrow();
      expect(() => StorePriceSchema.parse(invalid2)).toThrow();
    });

    it('should reject non-integer prices', () => {
      const invalid = {
        store: 'Store',
        price: 1999.99,
      };
      expect(() => StorePriceSchema.parse(invalid)).toThrow();
    });

    it('should reject rating below 0', () => {
      const invalid = {
        store: 'Store',
        price: 1000,
        rating: -1,
      };
      expect(() => StorePriceSchema.parse(invalid)).toThrow();
    });

    it('should reject rating above 5', () => {
      const invalid = {
        store: 'Store',
        price: 1000,
        rating: 5.1,
      };
      expect(() => StorePriceSchema.parse(invalid)).toThrow();
    });

    it('should accept rating of 0', () => {
      const valid = {
        store: 'Store',
        price: 1000,
        rating: 0,
      };
      expect(() => StorePriceSchema.parse(valid)).not.toThrow();
    });

    it('should accept rating of 5', () => {
      const valid = {
        store: 'Store',
        price: 1000,
        rating: 5,
      };
      expect(() => StorePriceSchema.parse(valid)).not.toThrow();
    });
  });

  describe('PriceComparisonSchema', () => {
    it('should validate price comparison with multiple stores', () => {
      const valid = {
        product: 'iPhone 13',
        prices: [
          { store: 'MercadoLibre', price: 2500000, rating: 4.5 },
          { store: 'Falabella', price: 2700000, rating: 4.3 },
        ],
      };
      expect(() => PriceComparisonSchema.parse(valid)).not.toThrow();
    });

    it('should validate price comparison with one store', () => {
      const valid = {
        product: 'PlayStation 5',
        prices: [
          { store: 'Éxito', price: 3000000 },
        ],
      };
      expect(() => PriceComparisonSchema.parse(valid)).not.toThrow();
    });

    it('should reject empty product name', () => {
      const invalid = {
        product: '',
        prices: [
          { store: 'Store', price: 1000 },
        ],
      };
      expect(() => PriceComparisonSchema.parse(invalid)).toThrow();
    });

    it('should reject product name longer than 100 characters', () => {
      const invalid = {
        product: 'a'.repeat(101),
        prices: [
          { store: 'Store', price: 1000 },
        ],
      };
      expect(() => PriceComparisonSchema.parse(invalid)).toThrow();
    });

    it('should reject empty prices array', () => {
      const invalid = {
        product: 'Test Product',
        prices: [],
      };
      expect(() => PriceComparisonSchema.parse(invalid)).toThrow();
    });

    it('should reject more than 10 prices', () => {
      const invalid = {
        product: 'Test Product',
        prices: Array(11).fill({ store: 'Store', price: 1000 }),
      };
      expect(() => PriceComparisonSchema.parse(invalid)).toThrow();
    });

    it('should accept exactly 10 prices', () => {
      const valid = {
        product: 'Test Product',
        prices: Array(10).fill({ store: 'Store', price: 1000 }),
      };
      expect(() => PriceComparisonSchema.parse(valid)).not.toThrow();
    });
  });

  describe('validateUserIntent', () => {
    it('should return validated data for valid input', () => {
      const input = {
        intent: 'purchase_advice',
        product: 'iPhone',
      };
      const result = validateUserIntent(input);
      expect(result).toEqual(input);
    });

    it('should return null for invalid input', () => {
      const invalid = {
        intent: 'invalid',
        product: 'test',
      };
      const result = validateUserIntent(invalid);
      expect(result).toBeNull();
    });

    it('should return null for non-object input', () => {
      expect(validateUserIntent('string')).toBeNull();
      expect(validateUserIntent(123)).toBeNull();
      expect(validateUserIntent(null)).toBeNull();
      expect(validateUserIntent(undefined)).toBeNull();
    });

    it('should handle malformed data', () => {
      const invalid = {
        intent: 'purchase_advice',
        product: { nested: 'object' },
      };
      const result = validateUserIntent(invalid);
      expect(result).toBeNull();
    });
  });

  describe('validatePriceComparison', () => {
    it('should return validated data for valid input', () => {
      const input = {
        product: 'iPhone',
        prices: [
          { store: 'Store A', price: 1000 },
          { store: 'Store B', price: 1200, rating: 4.5 },
        ],
      };
      const result = validatePriceComparison(input);
      expect(result).toEqual(input);
    });

    it('should return null for invalid input', () => {
      const invalid = {
        product: 'iPhone',
        prices: [],
      };
      const result = validatePriceComparison(invalid);
      expect(result).toBeNull();
    });

    it('should return null for non-object input', () => {
      expect(validatePriceComparison('string')).toBeNull();
      expect(validatePriceComparison(123)).toBeNull();
      expect(validatePriceComparison(null)).toBeNull();
      expect(validatePriceComparison(undefined)).toBeNull();
    });

    it('should handle invalid price objects', () => {
      const invalid = {
        product: 'iPhone',
        prices: [
          { store: 'Store A' }, // missing price
        ],
      };
      const result = validatePriceComparison(invalid);
      expect(result).toBeNull();
    });

    it('should reject prices with extra fields', () => {
      const invalid = {
        product: 'iPhone',
        prices: [
          { store: 'Store A', price: 1000, extra: 'field' },
        ],
      };
      const result = validatePriceComparison(invalid);
      expect(result).toBeNull();
    });
  });
});
