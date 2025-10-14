export type CardIssuer = "Chase" | "Amex" | "Citi" | "Other";

export type OfferCategory =
  | "Dining"
  | "Travel"
  | "Grocery"
  | "Gas"
  | "Online"
  | "Other";

export type OfferStatus = "active" | "expired" | "maxed" | "archived";

export interface Card {
  id: string;
  issuer: CardIssuer;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Offer {
  id: string;
  merchant: string;
  cardId: string;
  rate: number;
  cashbackCap: number;
  cashbackEarned: number;
  totalSpendTracked: number;
  expireAt: number;
  category: OfferCategory;
  note?: string;
  status: OfferStatus;
  archivedAt?: number;
  creditedToLifetime?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SpendLog {
  id: string;
  offerId: string;
  amount: number;
  note?: string;
  createdAt: number;
}

export interface OfferStats {
  earned: number;
  remainCashback: number;
  remainSpendToCap: number;
  percent: number;
}

export interface AppStats {
  id: string;
  lifetimeCashbackEarned: number;
  lastUpdatedAt: number;
}
