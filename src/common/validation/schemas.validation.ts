import { z } from 'zod';

export const UserIntentSchema = z
  .object({
    intent: z.enum(['purchase_advice', 'farewell', 'other']),
    product: z.string().max(100).nullable(),
  })
  .strict();

export const StorePriceSchema = z
  .object({
    store: z.string().min(1).max(50),
    price: z.number().positive().int(),
    rating: z.number().min(0).max(5).optional(),
  })
  .strict();

export const PriceComparisonSchema = z
  .object({
    product: z.string().min(1).max(100),
    prices: z.array(StorePriceSchema).min(1).max(10),
  })
  .strict();

export type UserIntentValidated = z.infer<typeof UserIntentSchema>;
export type PriceComparisonValidated = z.infer<typeof PriceComparisonSchema>;

export function validateUserIntent(data: unknown): UserIntentValidated | null {
  try {
    return UserIntentSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validatePriceComparison(data: unknown): PriceComparisonValidated | null {
  try {
    return PriceComparisonSchema.parse(data);
  } catch (error) {
    return null;
  }
}
