export interface IUserIntent {
  intent: 'purchase_advice' | 'other';
  product: string | null;
}
