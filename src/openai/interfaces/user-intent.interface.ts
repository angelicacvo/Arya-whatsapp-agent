export interface IUserIntent {
  intent: 'purchase_advice' | 'farewell' | 'other';
  product: string | null;
}
