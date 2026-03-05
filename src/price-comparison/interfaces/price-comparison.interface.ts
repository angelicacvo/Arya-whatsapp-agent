export interface IStorePrice {
  store: string;
  price: number;
  rating?: number;
}

export interface IPriceComparison {
  product: string;
  prices: IStorePrice[];
  average_price: number;
  best_store: string;
  best_price: number;
  best_rated_store?: string;
  best_rating?: number;
  best_value_store?: string;
}
