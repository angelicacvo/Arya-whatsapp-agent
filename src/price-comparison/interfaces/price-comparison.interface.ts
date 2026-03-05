export interface IStorePrice {
  store: string;
  price: number;
}

export interface IPriceComparison {
  product: string;
  prices: IStorePrice[];
  average_price: number;
  best_store: string;
  best_price: number;
}
