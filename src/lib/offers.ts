import type { Offer, OfferStats, OfferStatus } from "./types";

const EPSILON = 1e-2;
const LARGE_NUMBER = Number.POSITIVE_INFINITY;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function recalcOfferProgress(offer: Offer): Offer {
  if (offer.rewardType === "threshold") {
    const threshold = offer.spendThreshold ?? 0;
    const reward = offer.rewardAmount ?? offer.cashbackCap;
    if (threshold <= 0) {
      return { ...offer, cashbackEarned: 0 };
    }
    const earned = offer.totalSpendTracked >= threshold ? reward : 0;
    return {
      ...offer,
      cashbackEarned: Math.min(earned, reward),
    };
  }

  if (offer.rate <= 0) {
    return offer;
  }

  const spendCap = offer.cashbackCap / offer.rate;
  const effectiveSpend = Math.min(offer.totalSpendTracked, spendCap);
  const cashbackEarned = Math.min(
    effectiveSpend * offer.rate,
    offer.cashbackCap,
  );

  return {
    ...offer,
    cashbackEarned,
  };
}

export function computeOfferStats(offer: Offer): OfferStats {
  if (offer.rewardType === "threshold") {
    const threshold = offer.spendThreshold ?? 0;
    const reward = offer.rewardAmount ?? offer.cashbackCap;
    if (threshold <= 0) {
      return {
        earned: offer.cashbackEarned,
        remainCashback: Math.max(0, reward - offer.cashbackEarned),
        remainSpendToCap: 0,
        percent: 0,
      };
    }
    const earned = offer.totalSpendTracked >= threshold ? reward : 0;
    const remainSpend = Math.max(0, threshold - offer.totalSpendTracked);
    const remainCashback = Math.max(0, reward - earned);
    const percent = Math.min(offer.totalSpendTracked / threshold, 1);
    return {
      earned,
      remainCashback,
      remainSpendToCap: remainSpend,
      percent,
    };
  }

  if (offer.rate <= 0) {
    return {
      earned: offer.cashbackEarned,
      remainCashback: 0,
      remainSpendToCap: 0,
      percent: 0,
    };
  }

  const spendCap = offer.cashbackCap / offer.rate;
  const effectiveSpend = Math.min(offer.totalSpendTracked, spendCap);
  const earned = Math.min(effectiveSpend * offer.rate, offer.cashbackCap);
  const remainCashback = Math.max(0, offer.cashbackCap - earned);
  const remainSpendToCap =
    remainCashback > 0 ? remainCashback / offer.rate : 0;
  const percent =
    offer.cashbackCap > 0 ? Math.min(earned / offer.cashbackCap, 1) : 0;

  return {
    earned,
    remainCashback,
    remainSpendToCap,
    percent,
  };
}

export function computeStatus(offer: Offer): OfferStatus {
  if (offer.status === "archived") {
    return "archived";
  }
  const now = Date.now();
  if (now > offer.expireAt) {
    return "expired";
  }
  if (isMaxedOut(offer)) {
    return "maxed";
  }
  return "active";
}

export function normalizeOffer(offer: Offer): Offer {
  const status = computeStatus(offer);
  if (status !== offer.status && offer.status !== "archived") {
    return { ...offer, status };
  }
  return offer;
}

export function isMaxedOut(offer: Offer): boolean {
  if (offer.status === "archived") return false;
  if (offer.rewardType === "threshold") {
    const threshold = offer.spendThreshold ?? 0;
    if (threshold <= 0) return false;
    return offer.totalSpendTracked >= threshold - EPSILON;
  }
  if (offer.cashbackCap <= 0 || offer.rate <= 0) {
    return false;
  }
  return offer.cashbackEarned >= offer.cashbackCap - EPSILON;
}

export function getRemainingSpendToCap(offer: Offer): number {
  if (offer.rewardType === "threshold") {
    const threshold = offer.spendThreshold ?? 0;
    if (threshold <= 0) return 0;
    return Math.max(0, threshold - offer.totalSpendTracked);
  }
  if (offer.rate <= 0) return LARGE_NUMBER;
  const remainCashback = Math.max(0, offer.cashbackCap - offer.cashbackEarned);
  if (remainCashback <= EPSILON) return 0;
  return remainCashback / offer.rate;
}

export function getDaysLeft(expireAt: number, now: number = Date.now()): number {
  const diff = expireAt - now;
  return Math.ceil(diff / DAY_IN_MS);
}

export function sortOffersByExpiry(a: Offer, b: Offer): number {
  const ax = a.expireAt ?? LARGE_NUMBER;
  const bx = b.expireAt ?? LARGE_NUMBER;
  if (ax !== bx) {
    return ax - bx;
  }

  const aRemain = getRemainingSpendToCap(a);
  const bRemain = getRemainingSpendToCap(b);
  if (aRemain !== bRemain) {
    return aRemain - bRemain;
  }

  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
}
